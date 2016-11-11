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

from django.conf import settings
from django.conf.urls import *
from django.views.generic.base import TemplateView
from xgds_image import views

urlpatterns = [
    url(r'^edit/(?P<imageSetID>[\d]+)$', views.editImage, {}, 'xgds_image_edit_image'),
    url(r'^import/', views.getImageImportPage, {}, 'xgds_image_import'),
    url(r'^saveImage/$', views.saveImage, {'loginRequired': False}, 'xgds_save_image'),
    url(r'^writeEvent/$', views.sdWriteEvent, {'loginRequired': False}, 'xgds_sd_write_event'),
    url(r'^updateImageInfo/$', views.updateImageInfo, {}, 'xgds_update_image_info'),
    url(r'^deleteImages/$', views.deleteImages, {}, 'xgds_delete_images'),
    url(r'^saveRotation/$', views.saveRotationValue, {}, 'xgds_image_save_rotation'),
    url(r'^getRotation/$', views.getRotationValue, {}, 'xgds_image_get_rotation'), 
    url(r'^checkTiles/(?P<imageSetPK>[\d]+)$', views.getTileState, {}, 'xgds_image_check_tiles'), 
    ]
