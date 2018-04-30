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
from django.utils.functional import lazy

from django.db.models import Q
from dal import autocomplete

from models import SingleImage, ImageSet
from geocamUtil.loader import LazyGetModelByName
from geocamUtil.forms.AbstractImportForm import getTimezoneChoices

from xgds_core.models import XgdsUser
from xgds_core.forms import SearchForm, AbstractImportVehicleForm


LOCATION_MODEL = LazyGetModelByName(settings.GEOCAM_TRACK_PAST_POSITION_MODEL)
IMAGE_SET_MODEL = LazyGetModelByName(settings.XGDS_IMAGE_IMAGE_SET_MODEL)

 
class UploadFileForm(AbstractImportVehicleForm):
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
            if 'alt' in positionDict:
                self.fields['altitude'].initial = positionDict['alt']
            if 'head' in positionDict:
                self.fields['heading'].initial = positionDict['head']
        
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
        if (('latitude' in self.changed_data) and ('longitude' in self.changed_data)) or ('altitude' in self.changed_data) or ('heading' in self.changed_data):
            if instance.user_position is None:
                instance.user_position = LOCATION_MODEL.get().objects.create(serverTimestamp = datetime.datetime.now(pytz.utc),
                                                                             timestamp = instance.acquisition_time,
                                                                             latitude = self.cleaned_data['latitude'],
                                                                             longitude = self.cleaned_data['longitude'], 
                                                                             altitude = self.cleaned_data['altitude'],
                                                                             heading = self.cleaned_data['heading'])
            else:
                instance.user_position.latitude = self.cleaned_data['latitude']
                instance.user_position.longitude = self.cleaned_data['longitude']
                instance.user_position.altitude = self.cleaned_data['altitude']
                instance.user_position.heading = self.cleaned_data['heading']
                instance.user_position.save()

        if commit:
            instance.save()
        return instance
        
class SearchImageSetForm(SearchForm):
    author = forms.ModelChoiceField(XgdsUser.objects.all(), 
                                    required=False,
                                    widget=autocomplete.ModelSelect2(url='select2_model_user'))
    
    min_acquisition_time = forms.DateTimeField(required=False, label='Min Time',
                                         widget=forms.DateTimeInput(attrs={'class': 'datetimepicker'}))
    max_acquisition_time = forms.DateTimeField(required=False, label = 'Max Time',
                                         widget=forms.DateTimeInput(attrs={'class': 'datetimepicker'}))
    
    acquisition_timezone = forms.ChoiceField(required=False, choices=lazy(getTimezoneChoices, list)(empty=True), 
                                             label='Time Zone', help_text='Required for Min/Max Time')

    
    field_order = IMAGE_SET_MODEL.get().getSearchFieldOrder()
    
    # populate the times properly
    def clean_min_acquisition_time(self):
        return self.clean_time('min_acquisition_time', self.clean_acquisition_timezone())

    # populate the times properly
    def clean_max_acquisition_time(self):
        return self.clean_time('max_acquisition_time', self.clean_acquisition_timezone())
    
    def clean_acquisition_timezone(self):
        if self.cleaned_data['acquisition_timezone'] == 'utc':
            return 'Etc/UTC'
        else:
            return self.cleaned_data['acquisition_timezone']
        return None

    def clean(self):
        cleaned_data = super(SearchImageSetForm, self).clean()
        acquisition_timezone = cleaned_data.get("acquisition_timezone")
        min_acquisition_time = cleaned_data.get("min_acquisition_time")
        max_acquisition_time = cleaned_data.get("max_acquisition_time")

        if min_acquisition_time or max_acquisition_time:
            if not acquisition_timezone:
                self.add_error('event_timezone',"Time Zone is required for min / max times.")
                raise forms.ValidationError(
                    "Time Zone is required for min / max times."
                )

    def buildQueryForField(self, fieldname, field, value, minimum=False, maximum=False):
        if fieldname == 'description' or fieldname == 'name':
            return self.buildContainsQuery(fieldname, field, value)
        return super(SearchImageSetForm, self).buildQueryForField(fieldname, field, value, minimum, maximum)
        

    class Meta:
        model = IMAGE_SET_MODEL.get()
        fields = IMAGE_SET_MODEL.get().getSearchFormFields()
