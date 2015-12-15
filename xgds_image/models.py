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
from django.db import models
from django.conf import settings
from django.contrib.auth.models import User
from django.contrib.contenttypes.models import ContentType
from django.core.urlresolvers import reverse

from geocamUtil.loader import LazyGetModelByName, getClassByName
from geocamUtil.defaultSettings import HOSTNAME
from geocamUtil.modelJson import modelToDict
from geocamTrack.models import AbstractResource


def getNewImageFileName(instance, filename):
    return settings.XGDS_IMAGE_DATA_SUBDIRECTORY + filename


class Camera(AbstractResource):
    serial = models.CharField(max_length=128, blank=True, null=True)
    
    """
    Camera class
    """
    pass


class AbstractImageSet(models.Model):
    """
    ImageSet is for supporting various resolution images from the same source image.
    Set includes the raw image and any resized images.
    Contains utility functions to fetch different sized images.
    """
    name = models.CharField(max_length=128, blank=True, null=True, help_text="human-readable image set name")
    shortName = models.CharField(max_length=32, blank=True, null=True, db_index=True, help_text="a short mnemonic code suitable to embed in a URL")
    camera = models.ForeignKey(settings.XGDS_IMAGE_CAMERA_MODEL)
    author = models.ForeignKey(User)
    creation_time = models.DateTimeField(blank=True, default=datetime.datetime.utcnow(), editable=False)
    deleted = models.BooleanField(default=False)
    description = models.CharField(max_length=128, blank=True)
    asset_position = models.ForeignKey(settings.GEOCAM_TRACK_PAST_POSITION_MODEL, null=True, blank=True )
    modification_time = models.DateTimeField(blank=True, default=datetime.datetime.utcnow(), editable=False)
    
    class Meta:
        abstract = True
    
    def __unicode__(self):
        return (u"ImageSet(%s, name='%s', shortName='%s')"
                % (self.pk, self.name, self.shortName))
        
    def toMapDict(self):
        """
        Return a reduced dictionary that will be turned to JSON for rendering in a map
        """
        result = modelToDict(self)
        result['id'] = self.pk
        result['app_label'] = self._meta.app_label
        result['model_type'] = self.__class__.__name__
        
        result['description'] = self.description
        result['view_url'] = reverse('xgds_image_view_image', kwargs={'imageSetID':self.pk})
        result['type'] = 'ImageSet'
        result['camera_name'] = self.camera.name
        result['author_name'] = self.author.username
        result['creation_time'] = self.creation_time.strftime("%Y-%m-%d %H:%M:%S UTC")
        rawImage = self.getRawImage()
        if rawImage:
            result['raw_image_url'] = settings.DATA_URL + rawImage.file.name
        thumbImage = self.getThumbnail()
        if thumbImage:
            result['thumbnail_image_url'] = settings.DATA_URL + thumbImage.file.name
        if self.asset_position:
            result['lat'] = self.asset_position.latitude
            result['lon'] = self.asset_position.longitude
            result['altitude'] = self.asset_position.altitude
            result['position_id'] = self.asset_position.pk
        else:
            result['lat'] = ""
            result['lon'] = ""
            result['altitude'] = ""
            result['position_id'] = ""
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
    creation_time = models.DateTimeField(blank=True, default=datetime.datetime.utcnow(), editable=False)
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