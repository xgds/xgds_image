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
from django.core.urlresolvers import reverse

import sys
import re
import requests

import datetime
from dateutil.parser import parse as dateparser
import pytz
import json
from xgds_core.importer.validate_timestamps import get_timestamp_from_filename

HTTP_PREFIX = 'https'

from django.contrib.sites.models import Site
# mysite = Site.objects.get_current()
# mysite.domain = 'localhost'
# mysite.name = 'My Site'
# mysite.save()
URL_PREFIX = Site.objects.get_current().domain


def fixTimezone(the_time):
    if not the_time.tzinfo or the_time.tzinfo.utcoffset(the_time) is None:
        the_time = pytz.timezone('utc').localize(the_time)
    the_time = the_time.astimezone(pytz.utc)
    return the_time


def parse_timestamp(string, time_format, regex):
    if time_format is not None:
        return get_timestamp_from_filename(filename, time_format, regex)

    else:
        float_seconds_pattern = '(?<!\d)(\d{10}\.\d*)(?!\d)' # ten digits, a '.', and more digits
        int_microseconds_pattern = '(?<!\d)(\d{16})(?!\d)' # sixteen digits

        match = re.search(float_seconds_pattern, string)
        if match:
            return datetime.datetime.utcfromtimestamp(float(match.group(0))).replace(tzinfo=pytz.utc)

        match = re.search(int_microseconds_pattern, string)
        if match:
            return datetime.datetime.utcfromtimestamp(1.e-6 * int(match.group(0))).replace(tzinfo=pytz.utc)

    return None


def import_image(filename, camera, username, password, camera_serial, time_format=None, regex=None):
    data ={
        'timezone': settings.TIME_ZONE,
        'vehicle': '',
        'username': username
    }
    # If we get a timestamp from filename then add it to exifData:
    timestamp = parse_timestamp(filename, time_format, regex)
    exifData = {}
    if timestamp is not None:
        exifData['DateTimeOriginal'] = timestamp.isoformat()
    if camera:
        exifData['Model'] = camera
    if camera_serial:
        exifData['BodySerialNumber'] = camera_serial

    data['exifData'] = json.dumps(exifData)

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
