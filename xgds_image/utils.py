# __BEGIN_LICENSE__
#Copyright (c) 2015, United States Government, as represented by the 
#Administrator of the National Aeronautics and Space Administration. 
#All rights reserved.
#
#The xGDS platform is licensed under the Apache License, Version 2.0 
#(the "License"); you may not use this file except in compliance with the License. 
#You may obtain a copy of the License at 
#http://www.apache.org/licenses/LICENSE-2.0.
#
#Unless required by applicable law or agreed to in writing, software distributed 
#under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR 
#CONDITIONS OF ANY KIND, either express or implied. See the License for the 
#specific language governing permissions and limitations under the License.
# __END_LICENSE__

import PIL
import PIL.ExifTags
import datetime
from PIL import Image
import glob, os
from django.conf import settings


def createThumbnailFile(src):
    size = 128, 128 #TODO: change this to fit the aspect ratio from image size.
    imgDir = settings.DATA_ROOT + settings.XGDS_IMAGE_DATA_SUBDIRECTORY
    im = Image.open(imgDir + src)
    im.thumbnail(size, Image.ANTIALIAS)
    dstFileName = 'thumbnail_' + src
    dst = imgDir + dstFileName
    try: 
        im.save(dst)
    except: 
        pass  # image already exists.
    return settings.XGDS_IMAGE_DATA_SUBDIRECTORY + dstFileName

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


def getGPSDatetime(exifData):
    gpsDateTime = None
    if "GPSInfo" in exifData:
        gpsInfo = exifData['GPSInfo']
        GPSDate = ""
        GPSTime = ""
        try: 
            GPSDate = gpsInfo['GPSDateStamp']
            GPSDate = datetime.datetime.strptime(GPSDate,"%Y:%m:%d")
            GPSDate = datetime.datetime.strftime(GPSDate, "%Y-%m-%d")
        except:
            pass
        try:
            GPSTime = gpsInfo['GPSTimeStamp']
            GPSTimeH = GPSTime[0][0]
            GPSTimeM = GPSTime[1][0]
            GPSTimeS = GPSTime[2][0] / 1000
            GPSTime = str(GPSTimeH) + ':' + str(GPSTimeM) + ':' + str(GPSTimeS)
        except:
            pass
        
        gpsDateTime = GPSDate + " " + GPSTime
        gpsDateTime = datetime.datetime.strptime(gpsDateTime,"%Y-%m-%d %H:%M:%S")
    return gpsDateTime


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