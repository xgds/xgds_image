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
from datetime import datetime

from django.forms.formsets import formset_factory
from django.shortcuts import render_to_response, get_object_or_404
from django.http import HttpResponseRedirect, HttpResponseForbidden, Http404, HttpResponse
from django.template import RequestContext
from django.utils.translation import ugettext, ugettext_lazy as _
from django.core.urlresolvers import reverse
from models import *
from forms import UploadFileForm, ImageSetForm
from xgds_image import settings
from xgds_map_server.views import get_handlebars_templates
from xgds_data.forms import SearchForm, SpecializedForm
from xgds_image.utils import getLatLon, getExifData, getGPSDatetime, createThumbnailFile
from geocamUtil.loader import getModelByName

import pydevd
from apps.geocamUtil.models.UuidField import makeUuid

PAST_POSITION_MODEL = settings.GEOCAM_TRACK_PAST_POSITION_MODEL

def getImageUploadPage(request):
    imageSets = ImageSet.objects.filter(author = request.user)
    imageSets = imageSets.order_by('creation_time')
    imageSetsJson = [json.dumps(imageSet.toMapDict()) for imageSet in imageSets]
    # options for select boxes in the more info template.
    allAuthors = [{'author_name_index': [str(user.username), int(user.id)]} for user in User.objects.all()]
    allCameras = [{'camera_name_index': [str(camera.name), int(camera.id)]} for camera in Camera.objects.all()]
    # map plus image templates for now
    fullTemplateList = list(settings.XGDS_MAP_SERVER_HANDLEBARS_DIRS)
    fullTemplateList.append(settings.XGDS_IMAGE_HANDLEBARS_DIR[0])
    templates = get_handlebars_templates(fullTemplateList)
    data = {'imageSetsJson': imageSetsJson,
            'allAuthors': allAuthors,
            'allCameras': allCameras,
            'templates': templates,
            'app': 'xgds_map_server/js/simpleMapApp.js'}
    return render_to_response("xgds_image/imageUpload.html", data,
                              context_instance=RequestContext(request))

    
def getImageSearchPage(request):
    fullTemplateList = list(settings.XGDS_MAP_SERVER_HANDLEBARS_DIRS)
    fullTemplateList.append(settings.XGDS_IMAGE_HANDLEBARS_DIR[0])
    templates = get_handlebars_templates(fullTemplateList)
    # search stuff
    theForm = SpecializedForm(SearchForm, ImageSet)
    theFormSetMaker = formset_factory(theForm, extra=0)
    theFormSet = theFormSetMaker(initial=[{'modelClass': AbstractImageSet}])
    return render_to_response("xgds_image/imageSearch.html", 
                              {'templates': templates,
                               'formset': theFormSet,
                               'app': 'xgds_map_server/js/simpleMapApp.js'},
                              context_instance=RequestContext(request))


def updateImageInfo(request):
    """
    Saves update image info entered by the user in the image view.
    """
    print "Inside updateImageInfo"
    pydevd.settrace('128.102.236.253')
    if request.method == 'POST':
        form = ImageSetForm(request.POST)
        if form.is_valid():
            imageSet = form.save(commit = False)
            # TODO PAST_POSITION_MODEL from geocamTrack stores the position data per track.
            # a track is associated with a resource
            # a geocamTrack resource has a name, optional user, uuid, and extras
            # We need a way to tie together a camera with a position source (ie track) in the past we have done this by name.
            # If we have a configuration where you 'register' a camera (by serial number) with a track source then it should lazily fill in the asset position from the track
            # This posiiton and altitude data should then be stored within the exif header for images 
            # sometimes an image will have its own exif asset position info in which case you SHOULD create a new asset position with the resource being the camera itself
#             print "imageSet asset_position is "
#             print imageSet.asset_position
#             imageSet.asset_position.latitude = request.POST['latitude']
#             imageSet.asset_position.save()
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


def createNewImageSet(exifData, author, fileName):
    """
    creates new imageSet instance
    """
    pydevd.settrace('128.102.236.253')
    
    newImageSet = ImageSet()
    newImageSet.name = fileName
    
    # set camera 
    cameraName = exifData['Model'] #TODO: change to serial number
    #TODO: what are we storing in the camera model? 
    cameras = Camera.objects.filter(name = cameraName)
    if cameras.exists():
        newImageSet.camera = cameras[0] 
    else: 
        newImageSet.camera = Camera(name = cameraName)
    
    # make sure there is a track for this camera for today
    # right now we are haivng one track for each camera.  In future we need to segment this by mission day or by 'flight' and
    # we will want to set a track 'source' for the camera
    # related_name = settings.GEOCAM_TRACK_TRACK_MODEL + "_related_set"
    # TODO make the below generic
    TRACK_MODEL = LazyGetModelByName(settings.GEOCAM_TRACK_TRACK_MODEL)
    tracks = TRACK_MODEL.get().objects.filter(resource=newImageSet.camera)
    if not tracks:
        track = TRACK_MODEL.get().objects.create(name=newImageSet.camera.name, resource=newImageSet.camera, uuid=makeUuid())
    else:
        track = tracks[0]
    # set location
    gpsLatLon = getLatLon(exifData)
    
    positionModel = LazyGetModelByName(PAST_POSITION_MODEL).get()
#     dummyTrack = getModelByName(settings.GEOCAM_TRACK_TRACK_MODEL).objects.get(name="dummy_track")
    try: # if there is GPS 
        gpsTimeStamp = getGPSDatetime(exifData) #TODO: use the DatetimeOriginal and check that it is in uTC
        position = positionModel.create(track = track, 
                                        timestamp= gpsTimeStamp,
                                        latitude = gpsLatLon[0], 
                                        longitude= gpsLatLon[1])
    except:
        position = positionModel.create(track = track,
                                        timestamp = None,
                                        latitude = None,
                                        longitude = None)
        print "Position is not available for this image"
    
    newImageSet.asset_position = position
    # set author
    newImageSet.author = author
    # set time stamp
    exifTime = time.strptime(str(exifData['DateTimeOriginal']),"%Y:%m:%d %H:%M:%S")
    newImageSet.creation_time = time.strftime("%Y-%m-%d %H:%M:%S", exifTime)
        
    return newImageSet


def saveImage(request):
    """
    Image drag and drop, saves the files and to the database.
    """
    if request.method == 'POST':
        form = UploadFileForm(request.POST, request.FILES)
        if form.is_valid():
            # create and save a single image obj
            uploadedFile = request.FILES['file']
            newImage = SingleImage.objects.create(file = uploadedFile)
            fileName = uploadedFile.name
            # create a new image set instance           
            exifData = getExifData(newImage)
            author = request.user  # set user as image author
            newSet = createNewImageSet(exifData, author, fileName)
            newSet.save()
            newImage.imageSet = newSet
            newImage.save()
            # create a thumbnail
            thumbnailFile = createThumbnailFile(fileName)
            thumbnail = SingleImage(file = thumbnailFile, 
                        raw = False, 
                        thumbnail = True,
                        imageSet = newSet)
            thumbnail.save()
            # pass the image set to the client as json.
            imageSetJson= newSet.toMapDict() 
            return HttpResponse(json.dumps({'success': 'true', 'json': imageSetJson}), 
                                content_type='application/json')
        else: 
            return HttpResponse(json.dumps({'error': 'Uploaded image is not valid'}), content_type='application/json')  