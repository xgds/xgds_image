# __BEGIN_LICENSE__
# Copyright (c) 2015, United States Government, as represented by the
# Administrator of the National Aeronautics and Space Administration.
# All rights reserved.
#
# The xGDS platform is licensed under the Apache License, Version 2.0
# (the "License"); you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
# http://www.apache.org/licenses/LICENSE-2.0.
#
# Unless required by applicable law or agreed to in writing, software distributed
# under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
# CONDITIONS OF ANY KIND, either express or implied. See the License for the
# specific language governing permissions and limitations under the License.
# __END_LICENSE__

import json
import time
import sys
import traceback
from datetime import datetime
from django.conf import settings

from django.forms.formsets import formset_factory
from django.contrib.contenttypes.models import ContentType
from django.shortcuts import render_to_response, get_object_or_404
from django.http import HttpResponseRedirect, HttpResponseForbidden, Http404, HttpResponse
from django.template import RequestContext
from django.utils.translation import ugettext, ugettext_lazy as _
from django.core.urlresolvers import reverse
from xgds_image.models import *
from forms import UploadFileForm, ImageSetForm
from xgds_map_server.views import get_handlebars_templates
from xgds_data.forms import SearchForm, SpecializedForm
from xgds_image.utils import getLatLon, getExifData, getGPSDatetime, createThumbnailFile
from geocamUtil.loader import getModelByName

from apps.geocamUtil.models.UuidField import makeUuid
from apps.geocamUtil.loader import LazyGetModelByName


IMAGE_SET_MODEL = LazyGetModelByName(settings.XGDS_IMAGE_IMAGE_SET_MODEL)
SINGLE_IMAGE_MODEL = LazyGetModelByName(settings.XGDS_IMAGE_SINGLE_IMAGE_MODEL)
CAMERA_MODEL = LazyGetModelByName(settings.XGDS_IMAGE_CAMERA_MODEL)
TRACK_MODEL = LazyGetModelByName(settings.GEOCAM_TRACK_TRACK_MODEL)
POSITION_MODEL = LazyGetModelByName(settings.GEOCAM_TRACK_PAST_POSITION_MODEL)


def getImageViewPage(request, imageSetID):
    errors = None
    try:
        imageSet = IMAGE_SET_MODEL.get().objects.get(id=imageSetID)
        imageSetsJson = [json.dumps(imageSet.toMapDict())]
    except:
        imageSetsJson = []
        errors = "Image not found."
        
    fullTemplateList = list(settings.XGDS_MAP_SERVER_HANDLEBARS_DIRS)
    fullTemplateList.append(settings.XGDS_IMAGE_HANDLEBARS_DIR[0])
    data = {'imageSetsJson': imageSetsJson,
            'templates': get_handlebars_templates(fullTemplateList),
            'app': 'xgds_map_server/js/simpleMapApp.js',
            'errors': errors}
    return render_to_response("xgds_image/imageView.html", data,
                              context_instance=RequestContext(request))
    
def getImageUploadPage(request):
    imageSets = IMAGE_SET_MODEL.get().objects.filter(author = request.user)
    imageSets = imageSets.order_by('creation_time')
    imageSetsJson = [json.dumps(imageSet.toMapDict()) for imageSet in imageSets]
    # map plus image templates for now
    fullTemplateList = list(settings.XGDS_MAP_SERVER_HANDLEBARS_DIRS)
    fullTemplateList.append(settings.XGDS_IMAGE_HANDLEBARS_DIR[0])
    templates = get_handlebars_templates(fullTemplateList)
    data = {'imageSetsJson': imageSetsJson,
            'templates': templates,
            'app': 'xgds_map_server/js/simpleMapApp.js'}
    return render_to_response("xgds_image/imageUpload.html", data,
                              context_instance=RequestContext(request))

    
def getImageSearchPage(request):
    fullTemplateList = list(settings.XGDS_MAP_SERVER_HANDLEBARS_DIRS)
    fullTemplateList.append(settings.XGDS_IMAGE_HANDLEBARS_DIR[0])
    templates = get_handlebars_templates(fullTemplateList)
    # search stuff
    theForm = SpecializedForm(SearchForm, IMAGE_SET_MODEL.get())
    theFormSetMaker = formset_factory(theForm, extra=0)
    theFormSet = theFormSetMaker(initial=[{'modelClass': IMAGE_SET_MODEL.get()}])
    return render_to_response("xgds_image/imageSearch.html", 
                              {'imageSetsJson': "[]",
                               'templates': templates,
                               'formset': theFormSet,
                               'app': 'xgds_map_server/js/simpleMapApp.js'},
                              context_instance=RequestContext(request))


def updateImageInfo(request):
    """
    Saves update image info entered by the user in the image view.
    """
    if request.method == 'POST':
        imageSet = IMAGE_SET_MODEL.get().objects.get(id=request.POST['id'])
        form = ImageSetForm(request.POST, instance = imageSet)
        if form.is_valid():
            latitude =  form.cleaned_data['latitude']
            longitude =  form.cleaned_data['longitude']
            altitude =  form.cleaned_data['altitude']
#             imageSet.description = form.cleaned_data['description']
            imageSet = form.save(commit = False)
            if (latitude or longitude or altitude):
                if not imageSet.asset_position:            
                    track = getTrack(imageSet.camera)
                    imageSet.asset_position = POSITION_MODEL.get().objects.create(track = track, 
                                                                            timestamp= imageSet.creation_time,
                                                                            latitude = latitude, 
                                                                            longitude= longitude)
                else:
                    imageSet.asset_position.latitude =  latitude
                    imageSet.asset_position.longitude =  longitude
                try:
                    imageSet.asset_position.altitude = altitude
                except:
                    pass
                imageSet.asset_position.save()
            imageSet.save()
            response_data={}
            response_data['status'] = 'success'
            response_data['message'] = 'Save successful!'
            return HttpResponse(json.dumps(response_data),
                content_type="application/json"
            )
        else: 
            return HttpResponse(json.dumps({'status': 'error',
                                            'message': "Failed to save."}),
                                content_type='application/json')


def getTrack(camera):
    camera_model_type = ContentType.objects.get_for_model(camera)
    tracks = TRACK_MODEL.get().objects.filter(generic_resource_id=camera.id, generic_resource_content_type=camera_model_type)
    if not tracks:
        track = TRACK_MODEL.get().objects.create(name=camera.name, 
                                                 generic_resource=camera, 
                                                 uuid=makeUuid())
    else:
        track = tracks[0]
    return track


def getCameraObject(exif):
    '''
    Given image exif data, either creates a new camera object or returns an
    existing one.
    '''
    cameraName = exif['Model']
    cameras = CAMERA_MODEL.get().objects.filter(name = cameraName)
    if cameras.exists():
        return cameras[0]
    else: 
        return CAMERA_MODEL.get().objects.create(name = cameraName)
    
    
def getPositionObject(exif, camera):
    '''
    Given the image's exif data and a camera object, 
    creates a new position object that contains the lat and lon information.
    '''
    try: # if there is GPS
        track = getTrack(camera)
        gpsLatLon = getLatLon(exif)
        gpsTimeStamp = getGPSDatetime(exif) #TODO: use the DatetimeOriginal and check that it is in uTC
        if gpsTimeStamp and gpsLatLon[0] and gpsLatLon[1]:
            position = POSITION_MODEL.get().objects.create(track = track, 
                                                           timestamp= gpsTimeStamp,
                                                           latitude = gpsLatLon[0], 
                                                           longitude= gpsLatLon[1])
            return position
    except Exception:
        print 'no gps data for image not really an error'
        traceback.print_exc()
        return None


def saveImage(request):
    """
    Image drag and drop, saves the files and to the database.
    """
    if request.method == 'POST':
        form = UploadFileForm(request.POST, request.FILES)
        if form.is_valid():
            # create and save a single image obj
            uploadedFile = request.FILES['file']
            newImage = SINGLE_IMAGE_MODEL.get().objects.create(file = uploadedFile)
            exifData = getExifData(newImage)
            exifTime = datetime.datetime.strptime(str(exifData['DateTimeOriginal']),"%Y:%m:%d %H:%M:%S")
            newImage.creation_time = exifTime
            
            # create a new image set instance           
            author = request.user  # set user as image author
            newImageSet = IMAGE_SET_MODEL.get()()
            fileName = uploadedFile.name
            newImageSet.name = fileName
            newImageSet.camera = getCameraObject(exifData)
            position = getPositionObject(exifData, newImageSet.camera)
            if position:
                newImageSet.asset_position = position
            newImageSet.author = author
            newImageSet.save()
            
            # link the "image set" to "image".
            newImage.imageSet = newImageSet
            newImage.save()
            
            # create a thumbnail
            thumbnailFile = createThumbnailFile(fileName)
            thumbnail = SINGLE_IMAGE_MODEL.get()(file = thumbnailFile, 
                        raw = False, 
                        thumbnail = True,
                        imageSet = newImageSet)
            thumbnail.save()
            # pass the image set to the client as json.
            imageSetJson= newImageSet.toMapDict() 
            return HttpResponse(json.dumps({'success': 'true', 'json': imageSetJson}), 
                                content_type='application/json')
        else: 
            return HttpResponse(json.dumps({'error': 'Uploaded image is not valid'}), content_type='application/json')  