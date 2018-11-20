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

from django.conf.urls import url
from xgds_image import views

urlpatterns = [
    url(r'^getAnnotations/(?P<imagePK>[\d]+)$', views.getAnnotationsJson, {}, 'xgds_image_get_annotations'),
    url(r'^getAnnotationColors/$', views.getAnnotationColorsJson, {}, 'xgds_image_get_annotation_colors'),
    url(r'^saveImage/$', views.saveImage, {}, 'xgds_save_image'),
    url(r'^writeEvent/$', views.sdWriteEvent, {}, 'xgds_sd_write_event'),
    url(r'^saveFrame', views.grab_frame_save_image, {}, 'grab_frame_save_image'),  # grab and save frame
]
