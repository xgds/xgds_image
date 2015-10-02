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

from django import forms
from models import SingleImage, ImageSet

 
class UploadFileForm(forms.ModelForm):
    class Meta:
        model = SingleImage
        fields = ['file']
     
        
class ImageSetForm(forms.ModelForm):
    latitude = forms.FloatField()
    longitude = forms.FloatField()
    altitude = forms.FloatField()
    
    class Meta:
        model = ImageSet
        fields = ['camera', 'author', 'description']
    
    def save(self, commit=True):
        # do something with self.cleaned_data['temp_id']
        self.model.asset_position.latitude = self.cleaned_data['latitude']
        self.model.asset_position.longitude = self.cleaned_data['longitude']
        self.model.asset_position.altitude = self.cleaned_data['altitude']
        self.model.asset_position.save()
        return super(ImageSetForm, self).save(commit=commit)