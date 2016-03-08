#__BEGIN_LICENSE__
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
#__END_LICENSE__
import pytz
import json
import traceback
from datetime import datetime
from dateutil.parser import parse as dateparser

from django.utils import timezone
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
from xgds_image.utils import getLatLon, getExifData, getGPSDatetime, createThumbnailFile, getHeading, getAltitude

from geocamUtil.loader import getModelByName
from geocamUtil.datetimeJsonEncoder import DatetimeJsonEncoder
from geocamUtil import TimeUtil
from geocamUtil.models.UuidField import makeUuid
from geocamUtil.loader import LazyGetModelByName

from geocamTrack.views import getClosestPosition

IMAGE_SET_MODEL = LazyGetModelByName(settings.XGDS_IMAGE_IMAGE_SET_MODEL)
SINGLE_IMAGE_MODEL = LazyGetModelByName(settings.XGDS_IMAGE_SINGLE_IMAGE_MODEL)
CAMERA_MODEL = LazyGetModelByName(settings.XGDS_IMAGE_CAMERA_MODEL)
TRACK_MODEL = LazyGetModelByName(settings.GEOCAM_TRACK_TRACK_MODEL)
POSITION_MODEL = LazyGetModelByName(settings.GEOCAM_TRACK_PAST_POSITION_MODEL)
GEOCAM_TRACK_RESOURCE_MODEL = LazyGetModelByName(settings.GEOCAM_TRACK_RESOURCE_MODEL)


def getImageViewPage(request, imageSetID):
    errors = None
    try:
        imageSet = IMAGE_SET_MODEL.get().objects.get(pk=imageSetID)
        imageSetsJson = [json.dumps(imageSet.toMapDict())]
    except:
        imageSetsJson = []
        errors = "Image not found."
        
    fullTemplateList = list(settings.XGDS_MAP_SERVER_HANDLEBARS_DIRS)
    fullTemplateList.append(settings.XGDS_IMAGE_HANDLEBARS_DIR[0])
    data = {'imageSetsJson': imageSetsJson,
            'STATIC_URL': settings.STATIC_URL,
            'templates': get_handlebars_templates(fullTemplateList),
            'errors': errors}
    return render_to_response("xgds_image/imageView.html", data,
                              context_instance=RequestContext(request))
    
def getImageImportPage(request):
    # map plus image templates for now
    fullTemplateList = list(settings.XGDS_MAP_SERVER_HANDLEBARS_DIRS)
    fullTemplateList.append(settings.XGDS_IMAGE_HANDLEBARS_DIR[0])
    templates = get_handlebars_templates(fullTemplateList)
    data = {'imageSetsJson': [], #imageSetsJson,
            'templates': templates,
            'form': UploadFileForm(),
            'imageSetForm': ImageSetForm()
            }
    return render_to_response("xgds_image/imageImport.html", data,
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
                               'formset': theFormSet},
                              context_instance=RequestContext(request))

def updateImageInfo(request):
    """
    Saves update image info entered by the user in the image view.
    """
    if request.method == 'POST':
        imgId = request.POST['id']
        imageSet = IMAGE_SET_MODEL.get().objects.get(pk=imgId)
        form = ImageSetForm(request.POST, instance = imageSet)
        if form.is_valid():
            imageSet = form.save(commit = False)

            changed_position = request.POST['changed_position']
            if int(changed_position) == 1:
                latitude =  form.cleaned_data['latitude']
                longitude =  form.cleaned_data['longitude']
                altitude =  form.cleaned_data['altitude']
                heading =  form.cleaned_data['heading']
                if (latitude or longitude or altitude or heading):
                    if not imageSet.user_position:            
                        imageSet.user_position = POSITION_MODEL.get().objects.create(timestamp= imageSet.acquisition_time,
                                                                                     serverTimestamp = imageSet.acquisition_time,
                                                                                     latitude = latitude, 
                                                                                     longitude= longitude)
                    else:
                        imageSet.user_position.latitude =  latitude
                        imageSet.user_position.longitude =  longitude
                try:
                    imageSet.user_position.altitude = altitude
                except:
                    pass
                try:
                    imageSet.user_position.heading = heading
                except:
                    pass
                imageSet.user_position.save()
#             imageSet.description = form.cleaned_data['description']
            imageSet.save()
            return HttpResponse(json.dumps([imageSet.toMapDict()], cls=DatetimeJsonEncoder),
                content_type="application/json"
            )
        else: 
            return HttpResponse(json.dumps({'status': 'error',
                                            'message': "Failed to save."}),
                                content_type='application/json')


def deleteImages(request):
    if request.method == 'POST':
        idList = request.POST.getlist('id[]')
        for imageSetId in idList:
            imageSet = IMAGE_SET_MODEL.get().objects.get(id=imageSetId)
            imageSet.deleted = True
            imageSet.save()
        return HttpResponse(json.dumps({}), content_type = "application/json")
    else: 
        return HttpResponse(json.dumps({}), content_type = "application/json")
    

def createCameraResource(camera):
    ''' Create or retrieve resource instance for this exact camera
    '''
    name = camera.name
    if camera.serial:
        name = name + "_" +  camera.serial
    try:
        found = GEOCAM_TRACK_RESOURCE_MODEL.get().objects.get(name=name)
        return found
    except:
        return GEOCAM_TRACK_RESOURCE_MODEL.get().objects.create(name=name)


def getExifValue(exif, key):
    try: 
        return exif[key]
    except: 
        return None


def getCameraObject(exif):
    '''
    Given image exif data, either creates a new camera object or returns an
    existing one.
    '''
    cameraName = getExifValue(exif, 'Model')
    serial = getExifValue(exif, 'BodySerialNumber')
    cameras = CAMERA_MODEL.get().objects.filter(name=cameraName, serial=serial)
    if cameras.exists():
        return cameras[0]
    else: 
        return CAMERA_MODEL.get().objects.create(name = cameraName, serial=serial)
    
    
def buildExifPosition(exif, camera, resource, exifTime):
    '''
    Given the image's exif data and a camera object, 
    creates a new position object that contains the lat and lon information.
    '''
    gpsLatLon = getLatLon(exif)
    gpsTimeStamp = getGPSDatetime(exif) #TODO: use the DatetimeOriginal and check that it is in uTC
    if gpsTimeStamp:
        gpsTimeStamp.replace(tzinfo=exif.tzinfo)
        gpsTimeStamp = TimeUtil.timeZoneToUtc(gpsTimeStamp)
    else:
        gpsTimeStamp = exifTime
    
    if gpsTimeStamp and gpsLatLon[0] and gpsLatLon[1]:
        #TODO this requires that the position model has heading and altitude ...
        position = POSITION_MODEL.get().objects.create(serverTimestamp=timezone.now(),
                                                       timestamp= gpsTimeStamp,
                                                       latitude = gpsLatLon[0], 
                                                       longitude= gpsLatLon[1],
                                                       heading= getHeading(exif),
                                                       altitude=getAltitude(exif))
        return position
        
    return None


def getTrackPosition(timestamp, resource):
    '''
    Look up and return the closest tracked position if there is one.
    '''
    return getClosestPosition(timestamp=timestamp, resource=resource)

def saveImage(request):
    """
    Image drag and drop, saves the files and to the database.
    """
    if request.method == 'POST':
        form = UploadFileForm(request.POST, request.FILES)
        if form.is_valid():
            # create and save a single image obj
            uploadedFile = request.FILES['file']
            newImage = SINGLE_IMAGE_MODEL.get()(file = uploadedFile)
            
            form_tz = form.getTimezone()
            resource = form.getResource()
            exifData = getExifData(newImage)
            # get exif time
            exifTime  = None
            
            exifTime = getExifValue(exifData, 'DateTimeOriginal')
            if not exifTime: 
                exifTime = getExifValue(exifData, 'DateTime')

            if exifTime:
                exifTime = datetime.strptime(str(exifTime), '%Y:%m:%d %H:%M:%S')

            if (form_tz != pytz.utc) and exifTime:
                localized_time = form_tz.localize(exifTime)
                exifTime = TimeUtil.timeZoneToUtc(localized_time)
            else:
                exifTime = exifTime.replace(tzinfo=pytz.utc)
            
            # create a new image set instance           
            author = request.user  # set user as image author
            newImageSet = IMAGE_SET_MODEL.get()()
            newImageSet.acquisition_time = exifTime
            newImageSet.acquisition_timezone = form.getTimezoneName()
            fileName = uploadedFile.name
            newImageSet.name = fileName
            newImageSet.camera = getCameraObject(exifData)
            
            newImageSet.track_position = getTrackPosition(exifTime, resource)
            newImageSet.exif_position = buildExifPosition(exifData, newImageSet.camera, resource, exifTime)
            
            newImageSet.author = author
            newImageSet.save()
            
            # link the "image set" to "image".
            newImage.imageSet = newImageSet
            newImage.save()
            
            # create a thumbnail
            thumbnailFile = createThumbnailFile(fileName)
            SINGLE_IMAGE_MODEL.get().objects.create(file = thumbnailFile, 
                                                    raw = False, 
                                                    thumbnail = True,
                                                    imageSet = newImageSet)

            # pass the image set to the client as json.
            return HttpResponse(json.dumps({'success': 'true', 'json': newImageSet.toMapDict()}), 
                                content_type='application/json')
        else: 
            return HttpResponse(json.dumps({'error': 'Imported image is not valid'}), content_type='application/json')  