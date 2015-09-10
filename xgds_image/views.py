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

import glob
import json
import os
import time

from django.forms.formsets import formset_factory
from django.shortcuts import render_to_response
from django.http import HttpResponseRedirect, HttpResponseForbidden, Http404, HttpResponse
from django.template import RequestContext
from django.utils.translation import ugettext, ugettext_lazy as _
from django.core.urlresolvers import reverse
from models import *
from forms import UploadFileForm
from xgds_image import settings
from xgds_map_server.views import get_handlebars_templates
from xgds_data.forms import SearchForm, SpecializedForm
from xgds_image.utils import getLatLon, getExifData, getGPSDatetime
from geocamUtil.loader import getModelByName
# import pydevd


def getImageUploadPage(request):
    #TODO: filter the SingleImage so that it lists users's uploaded images.
    images = SingleImage.objects.all()  # @UndefinedVariable
    uploadedImages = [json.dumps(image.toMapDict()) for image in images]
    
    # map plus image templates for now
    fullTemplateList = list(settings.XGDS_MAP_SERVER_HANDLEBARS_DIRS)
    fullTemplateList.append(settings.XGDS_IMAGE_HANDLEBARS_DIR[0])
    templates = get_handlebars_templates(fullTemplateList)
    data = {'uploadedImages': uploadedImages,
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


def createNewImageSet(exifData, author):
    """
    creates new imageSet instance
    """
#     pydevd.settrace('128.102.236.48')
    # set location
    gpsLatLon = getLatLon(exifData)
    newImageSet = ImageSet()
    if gpsLatLon: 
        positionModel = getModelByName(PAST_POSITION_MODEL)
        dummyResource = getModelByName(settings.GEOCAM_TRACK_RESOURCE_MODEL).objects.create(name="dummy resource")
        dummyTrack = getModelByName(settings.GEOCAM_TRACK_TRACK_MODEL).objects.create(name="dummy track", resource = dummyResource)
        gpsTimeStamp = getGPSDatetime(exifData)
        position = positionModel.objects.create(track = dummyTrack, 
                                                timestamp= gpsTimeStamp,
                                                latitude = gpsLatLon[0], 
                                                longitude= gpsLatLon[1])
        newImageSet.asset_position = position
    # set author
    newImageSet.author = author
    # set time stamp
    exifTime = time.strptime(str(exifData['DateTimeOriginal']),"%Y:%m:%d %H:%M:%S")
    newImageSet.creation_time = time.strftime("%Y-%m-%d %H:%M:%S", exifTime)
    # set camera 
    cameraName = exifData['Model']
    newImageSet.camera = Camera.objects.create(display_name = cameraName)
    # save and return
    newImageSet.save()
    return newImageSet


def saveImage(request):
    """
    Image drag and drop, saves the files and to the database.
    """
    if request.method == 'POST':
        form = UploadFileForm(request.POST, request.FILES)
        if form.is_valid():
            # create and save a single image obj
            newFile = SingleImage(file = request.FILES['file'])
            
            # create a new image set instance           
            exifData = getExifData(newFile)
            author = request.user  # set user as image author
            newSet = createNewImageSet(exifData, author)
            newFile.imageSet = newSet
            newFile.save()
            
            # pass the uploaded image to front end as json.
            newFileJson = newFile.toMapDict() 
            return HttpResponse(json.dumps({'success': 'true', 'json': newFileJson}), 
                                content_type='application/json')
        else: 
            return HttpResponse(json.dumps({'error': 'Uploaded image is not valid'}), content_type='application/json')  