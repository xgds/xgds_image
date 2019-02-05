#!/usr/bin/env python
#  __BEGIN_LICENSE__
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

import django
django.setup()
from django.conf import settings

import sys
import re
import requests

import datetime
import pytz
import json
from xgds_core.importer.validate_timestamps import get_timestamp_from_filename
from geocamUtil.loader import LazyGetModelByName
from xgds_image.utils import getCameraByExif

HTTP_PREFIX = 'https'
URL_PREFIX = settings.XGDS_CORE_IMPORT_URL_PREFIX
IMAGE_SET_MODEL = LazyGetModelByName(settings.XGDS_IMAGE_IMAGE_SET_MODEL)
CAMERA_MODEL = LazyGetModelByName(settings.XGDS_IMAGE_CAMERA_MODEL)


def fixTimezone(the_time):
    if not the_time.tzinfo or the_time.tzinfo.utcoffset(the_time) is None:
        the_time = pytz.timezone('utc').localize(the_time)
    the_time = the_time.astimezone(pytz.utc)
    return the_time


def parse_timestamp(filename, time_format, regex):
    if time_format is not None:
        return get_timestamp_from_filename(filename, time_format, regex)

    else:
        float_seconds_pattern = '(?<!\d)(\d{10}\.\d*)(?!\d)' # ten digits, a '.', and more digits
        int_microseconds_pattern = '(?<!\d)(\d{16})(?!\d)' # sixteen digits

        match = re.search(float_seconds_pattern, filename)
        if match:
            return datetime.datetime.utcfromtimestamp(float(match.group(0))).replace(tzinfo=pytz.utc)

        match = re.search(int_microseconds_pattern, filename)
        if match:
            return datetime.datetime.utcfromtimestamp(1.e-6 * int(match.group(0))).replace(tzinfo=pytz.utc)

    return None


def check_data_exists(filename, timestamp, exif):
    """
    See if there is already identical data
    :return: True if it already exists, false otherwise
    """
    # get short filename
    tokens = filename.split('/')
    shortname = tokens[len(tokens) - 1]
    cameraId = getCameraByExif(exif)

    if cameraId is None:
        found = LazyGetModelByName(settings.XGDS_IMAGE_IMAGE_SET_MODEL).get().objects.filter(
            name=shortname,
            acquisition_time=timestamp)
    else:
        found = LazyGetModelByName(settings.XGDS_IMAGE_IMAGE_SET_MODEL).get().objects.filter(
            name=shortname,
            acquisition_time=timestamp,
            camera_id=cameraId)

    if found:
        return True
    return False


def import_image(filename, camera, username, password, camera_serial, time_format=None, regex=None, timestamp=None):
    """
    Imports a file into the database
    :param filename: full path to the file
    :param camera: Hercules, Argus, Acoustic, ...
    :param username: to put things in database
    :param password: to put things in database
    :param camera_serial: is stuffed into exif if it's provided
    :param time_format: seconds, microseconds, dateparser, or labphoto (takes time from dive)
    :param regex: for the dateparser if the time_format is dateparser
    :return:
    """
    data ={
        'timezone': settings.TIME_ZONE,
        'vehicle': '',
        'username': username
    }

    # If we get a timestamp from filename then add it to exifData:
    if timestamp:
        internal_timestamp = timestamp
    else:
        internal_timestamp = parse_timestamp(filename, time_format, regex)
    exifData = {}
    if internal_timestamp:
        exifData['DateTimeOriginal'] = internal_timestamp.isoformat()
    if camera:
        exifData['Model'] = camera
    if camera_serial:
        exifData['BodySerialNumber'] = camera_serial

    data['exifData'] = json.dumps(exifData)

    # check if image exists in database and error if it does
    if check_data_exists(filename, internal_timestamp, exifData):
        print " ABORTING: MATCHING DATA FOUND"
        raise Exception('Matching data found, image already imported', filename)

    fp = open(filename)
    files = {'file': fp}

    # TODO: reverse is only getting the last part, missing '<http(s)>://<hostname>/'
    # url = reverse('xgds_save_image')
    # ... so roll it like this:
    url = "%s://%s%s" % (HTTP_PREFIX, URL_PREFIX, '/xgds_image/rest/saveImage/')

    print url

    r = requests.post(url, data=data, files=files, verify=False, auth=(username, password))
    if r.status_code == 200:
        print 'HTTP status code:', r.status_code
        print r.text
        return 0
    else:
        sys.stderr.write('HTTP status code: %d\n' % r.status_code)
        sys.stderr.write(r.text)
        sys.stderr.write('\n')
        sys.stderr.flush()
        return -1


if __name__=='__main__':
    import optparse
    parser = optparse.OptionParser('usage: %prog')
    parser.add_option('-c', '--camera',
                      help='Name of the camera this image came from')
    parser.add_option('-s', '--serial',
                      help='Serial number of the camera this image came from')
    parser.add_option('-u', '--username', default='irg', help='username for xgds auth')
    parser.add_option('-p', '--password', help='authtoken for xgds authentication.  Can get it from https://xgds_server_name/accounts/rest/genToken/<username>')
    parser.add_option('-t', '--timeformat',
                      help='seconds, microseconds, or dateparser')
    parser.add_option('-r', '--regex',
                      help='If timeformat is dateparser, regex to get timestamp from filename')

    opts, args = parser.parse_args()
    camera = opts.camera
    filename = args[0]
    retval = import_image(filename, camera=camera, username=opts.username, password=opts.password, camera_serial=opts.serial,
                          time_format=opts.timeformat, regex=opts.regex)
    sys.exit(retval)