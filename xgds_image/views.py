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

import PIL
import PIL.ExifTags

from django.shortcuts import render_to_response
from django.http import HttpResponseRedirect, HttpResponseForbidden, Http404, HttpResponse
from django.template import RequestContext
from django.utils.translation import ugettext, ugettext_lazy as _
from django.core.urlresolvers import reverse
from models import SingleImage
from forms import UploadFileForm
from xgds_image import settings
from xgds_map_server.views import get_handlebars_templates


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
    return render_to_response("xgds_image/imageSearch.html", {},
                              context_instance=RequestContext(request))

def saveImage(request):
    """
    Image drag and drop, saves the files and to the database.
    """
    if request.method == 'POST':
        form = UploadFileForm(request.POST, request.FILES)
        if form.is_valid():
            newFile = SingleImage(file = request.FILES['file'])
            newFile.save()
            exifData = getExifData(newFile)
            gpsLatLon = getLatLon(exifData)
            # pass the uploaded image to front end as json.
            newFileJson = newFile.toMapDict() 
            return HttpResponse(json.dumps({'success': 'true', 'json': newFileJson}), 
                                content_type='application/json')
        else: 
            return HttpResponse(json.dumps({'error': 'Uploaded image is not valid'}), content_type='application/json')  
        
"""
Exif utility Functions
referenced: https://gist.github.com/erans/983821
"""
def getExifData(imageModelInstance):
    pilImageObj = PIL.Image.open(imageModelInstance.file)
    exifData = {}
    for tag,value in pilImageObj._getexif().items():
        decoded = PIL.ExifTags.TAGS.get(tag, tag)
        if tag in PIL.ExifTags.TAGS:
            if decoded == "GPSInfo":
                gpsData = {}
                for t in value:
                    gpsDecoded = PIL.ExifTags.GPSTAGS.get(t, t)
                    gpsData[gpsDecoded] = value[t]
                exifData[decoded] = gpsData
            else: 
                exifData[PIL.ExifTags.TAGS[tag]] = value
    return exifData

def getIfExists(data, key):
    if key in data:
        return data[key]
        
    return None
    
def convertToDegrees(value):
    """Helper function to convert the GPS coordinates stored in the EXIF to degress in float format"""
    d0 = value[0][0]
    d1 = value[0][1]
    d = float(d0) / float(d1)

    m0 = value[1][0]
    m1 = value[1][1]
    m = float(m0) / float(m1)

    s0 = value[2][0]
    s1 = value[2][1]
    s = float(s0) / float(s1)

    return d + (m / 60.0) + (s / 3600.0)

def getLatLon(exifData):
    """Returns the latitude and longitude, if available, from the provided exif_data (obtained through get_exif_data above)"""
    lat = None
    lon = None

    if "GPSInfo" in exifData:        
        gpsInfo = exifData["GPSInfo"]

        latitude = getIfExists(gpsInfo, "GPSLatitude")
        latitudeRef = getIfExists(gpsInfo, 'GPSLatitudeRef')
        longitude = getIfExists(gpsInfo, 'GPSLongitude')
        longitudeRef = getIfExists(gpsInfo, 'GPSLongitudeRef')

        if latitude and latitudeRef and longitude and longitudeRef:
            lat = convertToDegrees(latitude)
            if latitudeRef != "N":                     
                lat = 0 - lat

            lon = convertToDegrees(longitude)
            if longitudeRef != "E":
                lon = 0 - lon

    return lat, lon
   