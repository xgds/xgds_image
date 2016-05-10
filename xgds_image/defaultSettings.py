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

"""
This app may define some new parameters that can be modified in the
Django settings module.  Let's say one such parameter is FOO.  The
default value for FOO is defined in this file, like this:

  FOO = 'my default value'

If the admin for the site doesn't like the default value, they can
override it in the site-level settings module, like this:

  FOO = 'a better value'

Other modules can access the value of FOO like this:

  from django.conf import settings
  print settings.FOO

Don't try to get the value of FOO from django.conf.settings.  That
settings object will not know about the default value!
"""
import os
from geocamUtil.SettingsUtil import getOrCreateDict, getOrCreateArray

BOWER_INSTALLED_APPS = getOrCreateArray('BOWER_INSTALLED_APPS')
BOWER_INSTALLED_APPS += ['dropzone',
                         'openseadragon',
                         'typeahead.js'
                         ]

XGDS_IMAGE_DATA_SUBDIRECTORY = "xgds_image/"

XGDS_IMAGE_IMAGE_SET_MODEL = 'xgds_image.ImageSet'
XGDS_IMAGE_SINGLE_IMAGE_MODEL = 'xgds_image.SingleImage'
XGDS_IMAGE_CAMERA_MODEL = 'xgds_image.Camera'
XGDS_IMAGE_IMAGE_SET_MONIKER = 'Photo'

XGDS_CORE_TEMPLATE_DIRS = getOrCreateDict('XGDS_CORE_TEMPLATE_DIRS')
XGDS_CORE_TEMPLATE_DIRS[XGDS_IMAGE_IMAGE_SET_MODEL] = [os.path.join('xgds_image', 'templates', 'handlebars')]

XGDS_MAP_SERVER_JS_MAP = getOrCreateDict('XGDS_MAP_SERVER_JS_MAP')
XGDS_MAP_SERVER_JS_MAP[XGDS_IMAGE_IMAGE_SET_MONIKER] = {'ol': 'xgds_image/js/olImageMap.js',
                                                        'model': XGDS_IMAGE_IMAGE_SET_MODEL,
                                                        'columns': ['acquisition_time', 'timezone', 'name', 'author', 'thumbnail_image_url'],
                                                        'columnTitles': ['Acquisition', 'Timezone', 'Name', 'Author', ''],
                                                        'viewHandlebars': 'xgds_image/templates/handlebars/image-view2.handlebars',
                                                        'viewJS': ['/static/openseadragon/built-openseadragon/openseadragon/openseadragon.min.js',
                                                                   '/static/xgds_image/js/imageReview.js' ],
                                                        'viewCss': ['/static/xgds_image/css/xgds_image.css'],
                                                        'viewInitMethods': ['xgds_image.setupImageViewer'],
                                                        'event_time_field': 'acquisition_time',
                                                        'event_timezone_field': 'acquisition_timezone'
                                                        } 

XGDS_MAP_SERVER_JS_MAP[XGDS_IMAGE_IMAGE_SET_MONIKER] = {'ol': 'xgds_image/js/olImageMap.js',
                                                        'model': XGDS_IMAGE_IMAGE_SET_MODEL,
                                                        'columns': ['acquisition_time', 'timezone', 'name', 'author', 'thumbnail_image_url'],
                                                        'columnTitles': ['Acquisition', 'Timezone', 'Name', 'Author', ''],
                                                        'viewHandlebars': 'handlebars/image-view.handlebars'
                                                        }

XGDS_DATA_IMPORTS = getOrCreateDict('XGDS_DATA_IMPORTS')
XGDS_DATA_IMPORTS[XGDS_IMAGE_IMAGE_SET_MONIKER + 's'] = '/xgds_image/import'