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

import datetime
from django.db import models
from geocamUtil.loader import LazyGetModelByName, getClassByName
from geocamUtil.defaultSettings import HOSTNAME
from django.contrib.auth.models import User
from geocamUtil.models import AbstractEnumModel
from geocamUtil.modelJson import modelToDict
from django.conf import settings

PAST_POSITION_MODEL = settings.GEOCAM_TRACK_PAST_POSITION_MODEL


def getNewImageFileName(instance, filename):
    return settings.XGDS_IMAGE_DATA_SUBDIRECTORY + filename


class Camera(AbstractEnumModel):
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
    camera = models.ForeignKey(Camera)
    author = models.ForeignKey(User)
    creation_time = models.DateTimeField(blank=True, default=datetime.datetime.utcnow(), editable=False)
    deleted = models.BooleanField(default=False)
    description = models.CharField(max_length=128, blank=True)
    asset_position = models.ForeignKey(PAST_POSITION_MODEL, null=True, blank=True )
    
    def __unicode__(self):
        return (u"ImageSet(%s, name='%s', shortName='%s')"
                % (self.id, self.name, self.shortName))
        
    def toMapDict(self):
        """
        Return a reduced dictionary that will be turned to JSON for rendering in a map
        """
        result = modelToDict(self)
        result['id'] = self.id
        result['camera_name'] = self.camera.display_name
        result['author_name'] = self.author.username
        print "image set name and id"
        print self.name
        print self.id
        image = SingleImage.objects.get(imageSet = self, raw = True)
        print image
        result['raw_image_url'] = settings.DATA_URL + image.file.name
        if self.asset_position:
            result['latitude'] = self.asset_position.latitude
            result['longitude'] = self.asset_position.longitude
            result['altitude'] = self.asset_position.altitude
        else:
            result['latitude'] = "Not available"
            result['longitude'] = "Not available"
            result['altitude'] = "Not available"
        return result

    def getRawImage(self):
        return SingleImage.objects.get(imageSet=self, raw=True)

    def getLowerResImages(self):
        return SingleImage.objects.filter(imageSet=self, raw=False, thumbnail=False)
    
    def getThumbnail(self):
        return SingleImage.objects.filter(imageSet=self, thumbnail=True)


class ImageSet(AbstractImageSet):
    pass


class AbstractSingleImage(models.Model):
    """ 
    An abstract image which may not necessarily have a location on a map
    """
    file = models.ImageField(upload_to=getNewImageFileName, max_length=255)
    creation_time = models.DateTimeField(blank=True, default=datetime.datetime.utcnow(), editable=False)
    raw = models.BooleanField(default=True)
    imageSet = models.ForeignKey(ImageSet, null=True)
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