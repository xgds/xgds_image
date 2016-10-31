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

import os
import datetime
from io import BytesIO
from PIL import Image, ExifTags
from django.conf import settings
from django.core.files import File

def getExifValue(exif, key):
    try: 
        return exif[key]
    except: 
        return None

"""
Returns a file object containing the thumbnail image. It is the 
caller's responsibility to save it or do whatever else they wanna do...
"""
def createThumbnailFile(src):
    size = 250, 250 
    im = Image.open(src)
    im.thumbnail(size, Image.ANTIALIAS)
    srcName, srcExt = os.path.splitext(os.path.basename(src.name))
    dstFileName = '%s_thumbnail%s' % (srcName, srcExt)
    dstBytes = BytesIO()
    im.save(dstBytes, "JPEG")
    thumbFile = File(dstBytes)
    thumbFile.name = dstFileName
    return File(thumbFile)


def getHeightWidth(imageModelInstance):
    """ Read size and width with PIL
    """
    pilImageObj = Image.open(imageModelInstance.file)
    return pilImageObj.size

"""
Exif utility Functions
referenced: https://gist.github.com/erans/983821
"""
def getExifData(imageModelInstance):
    pilImageObj = Image.open(imageModelInstance.file)
    exifData = {}
    try: 
        pilExif = pilImageObj._getexif()
        for tag,value in pilExif.items():
            decoded = ExifTags.TAGS.get(tag, tag)
            if tag in ExifTags.TAGS:
                if decoded == "GPSInfo":
                    gpsData = {}
                    for t in value:
                        gpsDecoded = ExifTags.GPSTAGS.get(t, t)
                        gpsData[gpsDecoded] = value[t]
                    exifData[decoded] = gpsData
                else: 
                    exifData[ExifTags.TAGS[tag]] = value
    except: 
        pass
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
    result = None
    if "GPSInfo" in exifData:
        gpsInfo = exifData['GPSInfo']
        GPSDate = ""
        GPSTime = ""
        
        try: 
            GPSDate = gpsInfo['GPSDateStamp']
            theday = datetime.datetime.strptime(GPSDate,"%Y:%m:%d")
        except:
            pass
        try:
            GPSTime = gpsInfo['GPSTimeStamp']
            h = GPSTime[0][0]
            m = GPSTime[1][0]
            s = GPSTime[2][0]/GPSTime[2][1]
            result = datetime.datetime.combine(theday, datetime.time(hour=h, minute=m, second=int(s)))
        except:
            pass
        
    return result


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

def getAltitude(exifData):
    """Returns the heading, if available, from the provided exif_data (obtained through get_exif_data above)"""
    altitude = None
    if "GPSInfo" in exifData:        
        gpsInfo = exifData["GPSInfo"]
        altitude_tuple = getIfExists(gpsInfo, "GPSAltitude")
        if altitude_tuple:
            # no clue if this is right either
            return altitude_tuple[0]
    return altitude

def getHeading(exifData):
    """Returns the heading, if available, from the provided exif_data (obtained through get_exif_data above)"""
    heading = None

    if "GPSInfo" in exifData:        
        gpsInfo = exifData["GPSInfo"]
        heading_tuple = getIfExists(gpsInfo, "GPSImgDirection")
        # no clue if this is right, totally guessing ...
        if heading_tuple and len(heading_tuple) == 2:
            heading = int(heading_tuple[0])/int(heading_tuple[1])

    return heading
