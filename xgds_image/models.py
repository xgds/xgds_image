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

from django.db import models
from django.conf import settings
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from django.utils import timezone

from geocamUtil.loader import LazyGetModelByName, getClassByName
from geocamUtil.defaultSettings import HOSTNAME
from geocamUtil.modelJson import modelToDict
from geocamTrack.models import AbstractResource

from xgds_notes2.models import NoteMixin

def getNewImageFileName(instance, filename):
    return settings.XGDS_IMAGE_DATA_SUBDIRECTORY + filename


class Camera(AbstractResource):
    serial = models.CharField(max_length=128, blank=True, null=True)
    
    """
    Camera class
    """
    pass


class AbstractImageSet(models.Model, NoteMixin):
    """
    ImageSet is for supporting various resolution images from the same source image.
    Set includes the raw image and any resized images.
    Contains utility functions to fetch different sized images.
    """
    name = models.CharField(max_length=128, blank=True, null=True, help_text="human-readable image set name")
    shortName = models.CharField(max_length=32, blank=True, null=True, db_index=True, help_text="a short mnemonic code suitable to embed in a URL")
    camera = models.ForeignKey(settings.XGDS_IMAGE_CAMERA_MODEL)
    author = models.ForeignKey(User)
    creation_time = models.DateTimeField(blank=True, default=timezone.now, editable=False)
    deleted = models.BooleanField(default=False)
    description = models.CharField(max_length=128, blank=True)
    track_position = models.ForeignKey(settings.GEOCAM_TRACK_PAST_POSITION_MODEL, null=True, blank=True )
    exif_position = models.ForeignKey(settings.GEOCAM_TRACK_PAST_POSITION_MODEL, null=True, blank=True, related_name="image_exif_set" )
    user_position = models.ForeignKey(settings.GEOCAM_TRACK_PAST_POSITION_MODEL, null=True, blank=True, related_name="image_user_set" )
    modification_time = models.DateTimeField(blank=True, default=timezone.now, editable=False)
    acquisition_time = models.DateTimeField(editable=False)
    acquisition_timezone = models.CharField(null=True, blank=False, max_length=128, default=settings.TIME_ZONE)
    
    @property
    def view_url(self):
        return reverse('xgds_image_view_image', kwargs={'imageSetID':self.pk})
    
    @property
    def thumbnail_url(self):
        thumbImage = self.getThumbnail()
        if thumbImage:
            return settings.DATA_URL + thumbImage.file.name
    
    def getAuthorName(self):
        authorname = self.author.username
        if self.author.first_name:
            authorname = self.author.first_name
            if self.author.last_name:
                authorname = authorname + " " + self.author.last_name
        return authorname
    
    
    class Meta:
        abstract = True
    
    def __unicode__(self):
        return (u"ImageSet(%s, name='%s', shortName='%s')"
                % (self.pk, self.name, self.shortName))
    
    def getPositionDict(self):
        ''' override if you want to change the logic for how the positions are prioritized in JSON.
        Right now exif_position is from the camera, track_position is from the track, and user_position stores any hand edits.
        track provides lat lon and altitude, exif provides heading, and user trumps all.
        '''
        result = {}
        result['altitude'] = ""
        result['heading'] = ""

        if self.user_position:
            result['lat'] = self.user_position.latitude
            result['lon'] = self.user_position.longitude
            if hasattr(self.user_position, 'altitude'):
                result['altitude'] = self.user_position.altitude
            result['position_id'] = self.user_position.pk
            if hasattr(self.user_position, 'heading'):
                result['heading'] = self.user_position.heading
            return result
        
        result['position_id'] = ""
        if self.track_position:
            result['lat'] = self.track_position.latitude
            result['lon'] = self.track_position.longitude
            if self.track_position.altitude:
                result['altitude'] = self.track_position.altitude
            if self.exif_position:
                if hasattr(self.exif_position, 'heading'):
                    result['heading'] = self.exif_position.heading
                elif hasattr(self.track_position, 'heading'):
                    result['heading'] = self.track_position.heading
                if result['altitude'] == '' and hasattr(self.exif_position, 'altitude'):
                    result['altitude'] = self.track_position.altitude
            return result
        elif self.exif_position:
            result['lat'] = self.exif_position.latitude
            result['lon'] = self.exif_position.longitude
            if hasattr(self.exif_position, 'altitude'):
                result['altitude'] = self.exif_position.altitude
            if hasattr(self.exif_position, 'heading'):
                result['heading'] = self.exif_position.heading
        else: 
            result['lat'] = ""
            result['lon'] = ""
            
        return result
        
    def toMapDict(self):
        """
        Return a reduced dictionary that will be turned to JSON for rendering in a map
        """
        result = modelToDict(self)
        result['id'] = int(self.pk)
        result['app_label'] = self._meta.app_label
        t = type(self)
        if t._deferred:
            t = t.__base__
        
        result['model_type'] = t._meta.object_name
        
        result['description'] = self.description
        result['view_url'] = self.view_url
        result['type'] = 'ImageSet'
        result['camera_name'] = self.camera.name
        result['author'] = self.getAuthorName()
        result['creation_time'] = self.creation_time.strftime("%Y-%m-%d %H:%M:%S UTC")
        result['acquisition_time'] = self.acquisition_time.strftime("%Y-%m-%d %H:%M:%S UTC")
        result['acquisition_timezone'] = self.acquisition_timezone
        rawImage = self.getRawImage()
        if rawImage:
            result['raw_image_url'] = settings.DATA_URL + rawImage.file.name
        thumbImage = self.getThumbnail()
        if thumbImage:
            result['thumbnail_image_url'] = self.thumbnail_url
        
        result.update(self.getPositionDict())
        return result

    def getRawImage(self):
        rawImages = self.images.filter(raw=True)
        if rawImages:
            return rawImages[0]
        else:
            return None

    def getLowerResImages(self):
        return self.images.filter(raw=False, thumbnail=False)
    
    def getThumbnail(self):
        thumbImages = self.images.filter(thumbnail=True)
        if thumbImages:
            return thumbImages[0]
        else:
            return None


class ImageSet(AbstractImageSet):
    pass


class AbstractSingleImage(models.Model):
    """ 
    An abstract image which may not necessarily have a location on a map
    """
    file = models.ImageField(upload_to=getNewImageFileName, max_length=255)
    creation_time = models.DateTimeField(blank=True, default=timezone.now, editable=False)
    raw = models.BooleanField(default=True)
    imageSet = models.ForeignKey(settings.XGDS_IMAGE_IMAGE_SET_MODEL, null=True, related_name="images")
    thumbnail = models.BooleanField(default=False)
       
    class Meta:
        abstract = True

        

class SingleImage(AbstractSingleImage):
    """ This can be used for screenshots or non geolocated images 
    """
    def toMapDict(self):
        """
        Return a reduced dictionary that will be turned to JSON
        """
        result = modelToDict(self)
        return result