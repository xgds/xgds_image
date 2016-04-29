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

import datetime
import pytz
from django import forms
from django.conf import settings
from models import SingleImage, ImageSet
from geocamUtil.loader import LazyGetModelByName

from geocamTrack.forms import AbstractImportTrackedForm
LOCATION_MODEL = LazyGetModelByName(settings.GEOCAM_TRACK_PAST_POSITION_MODEL)
from geocamTrack.utils import getClosestPosition
 
class UploadFileForm(AbstractImportTrackedForm):
    class Meta:
        model = SingleImage
        fields = ['file']
    
        
class ImageSetForm(forms.ModelForm):
    latitude = forms.FloatField(required=False)
    longitude = forms.FloatField(required=False)
    altitude = forms.FloatField(required=False)
    heading = forms.FloatField(required=False)
    description = forms.CharField(widget=forms.Textarea, required=False)
    
    id= forms.CharField(widget=forms.HiddenInput())
    class Meta:
        model = ImageSet
        fields = ['id', 'description', 'name']
        
    def __init__(self, *args, **kwargs):
        super(ImageSetForm, self).__init__(*args, **kwargs)
        if self.instance:
            positionDict = self.instance.getPositionDict()
            self.fields['latitude'].initial = positionDict['lat']
            self.fields['longitude'].initial = positionDict['lon']
            if 'altitude' in positionDict:
                self.fields['altitude'].initial = positionDict['altitude']
            if 'heading' in positionDict:
                self.fields['heading'].initial = positionDict['heading']
        
    def clean(self):
        """
        Checks that both lat and lon are entered (or both are empty)
        Checks that collection time is entered if user is entering position for the first time.
        """
        cleaned_data = super(ImageSetForm, self).clean()
        latitude = cleaned_data.get("latitude")
        longitude = cleaned_data.get("longitude")
        if (latitude and not longitude) or (not latitude and longitude):  # if only one of them is filled in
            msg = "Must enter both latitude and longitude or leave both blank."
            self.add_error('latitude', msg)
            self.add_error('longitude', msg)
#         if latitude and longitude:
#             instance = super(ImageSetForm, self).save(commit=False)
#             if instance.user_position is None:
#                 if not self.cleaned_data['collection_time']:
#                     msg = "Must enter collection time to record position"
#                     self.add_error('collection_time', msg)
                    
                    
    def save(self, commit=True):
        instance = super(ImageSetForm, self).save(commit=False)
        if (('latitude' in self.changed_data) and ('longitude' in self.changed_data)) or ('altitude' in self.changed_data):
            if instance.user_position is None:
                instance.user_position = LOCATION_MODEL.get().objects.create(serverTimestamp = datetime.datetime.now(pytz.utc),
                                                                             timestamp = instance.collection_time,
                                                                             latitude = self.cleaned_data['latitude'],
                                                                             longitude = self.cleaned_data['longitude'], 
                                                                             altitude = self.cleaned_data['altitude'])
            else:
                instance.user_position.latitude = self.cleaned_data['latitude']
                instance.user_position.longitude = self.cleaned_data['longitude']
                instance.user_position.altitude = self.cleaned_data['altitude']

        if commit:
            instance.save()
        return instance
        