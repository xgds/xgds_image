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

from django.conf.urls import url, include
from xgds_image import views

urlpatterns = [
    url(r'^edit/(?P<imageSetID>[\d]+)$', views.editImage, {}, 'xgds_image_edit_image'),
    url(r'^import/', views.getImageImportPage, {}, 'xgds_image_import'),
    url(r'^saveImage/$', views.saveImage, {}, 'xgds_save_image'),
    url(r'^writeEvent/$', views.sdWriteEvent, {}, 'xgds_sd_write_event'),
    url(r'^updateImageInfo/$', views.updateImageInfo, {}, 'xgds_update_image_info'),
    url(r'^deleteImages/$', views.deleteImages, {}, 'xgds_delete_images'),
    url(r'^saveRotation/$', views.saveRotationValue, {}, 'xgds_image_save_rotation'),
    url(r'^getRotation/$', views.getRotationValue, {}, 'xgds_image_get_rotation'),
    url(r'^checkTiles/(?P<imageSetPK>[\d]+)$', views.getTileState, {}, 'xgds_image_check_tiles'),
    #url(r'^testpage$', TemplateView.as_view(template_name='xgds_image/test.html'), {}, 'test'),
    url(r'^saveAnnotations/$', views.saveAnnotations, {}, 'xgds_image_save_annotations'),
    url(r'^alterAnnotation/$', views.alterAnnotation, {}, 'xgds_image_alter_annotations'),
    url(r'^deleteAnnotation/$', views.deleteAnnotation, {}, 'xgds_image_delete_annotation'),
    url(r'^addAnnotation/$', views.addAnnotation, {}, 'xgds_image_add_annotation'),
    url(r'^mergeImages/$', views.mergeImages, {}, 'xgds_image_merge_images'),
    
    # Including these in this order ensures that reverse will return the non-rest urls for use in our server
    url(r'^rest/', include('xgds_image.restUrls')),
    url('', include('xgds_image.restUrls')),

]
