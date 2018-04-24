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

XGDS_IMAGE_DATA_SUBDIRECTORY = "xgds_image/"

#  This is the directory appended to MEDIA_ROOT for storing generated deep zooms.
#  If defined, but not physically created, the directory will be created for you.
#  If not defined, the following default directory name will be used:
DEEPZOOM_ROOT = XGDS_IMAGE_DATA_SUBDIRECTORY + 'deepzoom_images/'

#  These are the keyword arguments used to initialize the deep zoom creator:
#  'tile_size', 'tile_overlap', 'tile_format', 'image_quality', 'resize_filter'.
#  They strike a good (maybe best?) balance between image fidelity and file size.
#  If not defined the following default values will be used:
DEEPZOOM_PARAMS = {'tile_size': 256,
                    'tile_overlap': 1,
                    'tile_format': "jpg",
                    'image_quality': 1.0,
                    'resize_filter': "antialias"}


XGDS_IMAGE_IMAGE_SET_MODEL = 'xgds_image.ImageSet'
XGDS_IMAGE_SINGLE_IMAGE_MODEL = 'xgds_image.SingleImage'
XGDS_IMAGE_CAMERA_MODEL = 'xgds_image.Camera'
XGDS_IMAGE_IMAGE_SET_MONIKER = 'Photo'

XGDS_CORE_TEMPLATE_DIRS = getOrCreateDict('XGDS_CORE_TEMPLATE_DIRS')
XGDS_CORE_TEMPLATE_DIRS[XGDS_IMAGE_IMAGE_SET_MODEL] = [os.path.join('xgds_image', 'templates', 'handlebars')]

XGDS_MAP_SERVER_JS_MAP = getOrCreateDict('XGDS_MAP_SERVER_JS_MAP')
STATIC_URL = '/static/'
EXTERNAL_URL = STATIC_URL
XGDS_MAP_SERVER_JS_MAP[XGDS_IMAGE_IMAGE_SET_MONIKER] = {'ol': 'xgds_image/js/olImageMap.js',
                                                        'model': XGDS_IMAGE_IMAGE_SET_MODEL,
                                                        'searchableColumns': ['name','description','flight_name', 'author_name'],
                                                        'columns': ['checkbox', 'acquisition_time', 'acquisition_timezone', 'author_name', 'name', 'description', 'thumbnail_image_url',  'pk', 'view_url',
                                                                    'camera_name', 'raw_image_url', 'app_label', 'model_type', 'type', 'lat', 'lon', 'alt', 'head','flight_name', 'deepzoom_file_url',
                                                                    'rotation_degrees', 'originalImageResolutionString', 'originalImageFileSizeMB', 'create_deepzoom','DT_RowId'],
                                                        'hiddenColumns': ['pk', 'view_url', 'camera_name', 'raw_image_url', 'app_label',  'resource_name', 'model_type','type',
                                                                          'lat','lon','alt','head','flight_name', 'deepzoom_file_url', 'rotation_degrees',
                                                                          'originalImageResolutionString', 'originalImageFileSizeMB', 'create_deepzoom', 'DT_RowId'],
                                                        'unsortableColumns': ['thumbnail_image_url'],
                                                        'columnTitles': ['Time', 'TZ', 'Author', 'Name',  'Description', 'Image'],
                                                        'viewHandlebars': 'xgds_image/templates/handlebars/image-view2.handlebars',
                                                        'viewJS': [EXTERNAL_URL + 'openseadragon/built-openseadragon/openseadragon/openseadragon.min.js',
                                                                   EXTERNAL_URL + 'openseadragon/built-openseadragon/openseadragon/openseadragon.js',
                                                                   EXTERNAL_URL + 'fabric.js/dist/fabric.min.js',
                                                                   EXTERNAL_URL + 'openseadragon-fabricjs-overlay/openseadragon-fabricjs-overlay.js',
                                                                   EXTERNAL_URL + 'spectrum-colorpicker/spectrum.js',
                                                                   EXTERNAL_URL + 'jquery-fileDownload/src/Scripts/jquery.fileDownload.js',
                                                                   STATIC_URL + 'xgds_image/js/imageAnnotation.js',
                                                                   STATIC_URL + 'xgds_image/js/imageReview.js' ],
                                                        'viewCss': [STATIC_URL + 'xgds_image/css/xgds_image.css',
                                                                    EXTERNAL_URL + 'spectrum/spectrum.css'],
                                                        'viewInitMethods': ['xgds_image.setupImageViewer'],
                                                        'viewResizeMethod': ['xgds_image.resizeImageViewer'],
                                                        'event_time_field': 'acquisition_time',
                                                        'event_timezone_field': 'acquisition_timezone',
                                                        'saveRotationUrl': '/xgds_image/saveRotation/',
                                                        'getRotationUrl': '/xgds_image/getRotation/',
                                                        'search_form_class': 'xgds_image.forms.SearchImageSetForm'
                                                       }

XGDS_DATA_IMPORTS = getOrCreateDict('XGDS_DATA_IMPORTS')
XGDS_DATA_IMPORTS[XGDS_IMAGE_IMAGE_SET_MONIKER + 's'] = '/xgds_image/import'
XGDS_IMAGE_DEFAULT_CREATE_DEEPZOOM = True

XGDS_IMAGE_ANNOTATED_IMAGES_SUBDIR = 'xgds_image_annotations'

XGDS_IMAGE_ARROW_ANNOTATION_MODEL = 'xgds_image.ArrowAnnotation'
XGDS_IMAGE_ELLIPSE_ANNOTATION_MODEL = 'xgds_image.EllipseAnnotation'
XGDS_IMAGE_RECTANGLE_ANNOTATION_MODEL = 'xgds_image.RectangleAnnotation'
XGDS_IMAGE_TEXT_ANNOTATION_MODEL = 'xgds_image.TextAnnotation'

