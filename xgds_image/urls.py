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

from django.conf.urls import *
from django.views.generic.base import TemplateView
from xgds_image import views

urlpatterns = patterns('',
#                        (r'^$', TemplateView.as_view(template_name='xgds_image/index.html'), {}, 'index'),
                       (r'^imageUpload/', views.getImageUploadPage, {}, 'xgds_image_upload'),
                       (r'^imageSearch/', views.getImageSearchPage, {}, 'xgds_image_search'),
                       (r'^dropzoneImage/$', views.dropzoneImage, {}, 'xgds_dropzone_image'),
                       )