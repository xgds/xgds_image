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

import os
import logging
import sys
import six
import xml.dom.minidom

from django.db import models
from django.conf import settings
from django.contrib.auth.models import User
from django.core.urlresolvers import reverse
from django.utils import timezone
from django.utils.text import slugify

from geocamUtil.loader import LazyGetModelByName, getClassByName
from geocamUtil.defaultSettings import HOSTNAME
from geocamUtil.modelJson import modelToDict
from geocamUtil.UserUtil import getUserName
from geocamTrack import models as geocamTrackModels

from xgds_notes2.models import NoteMixin, NoteLinksMixin
from xgds_core.couchDbStorage import CouchDbStorage
from xgds_core.models import SearchableModel
from xgds_core.views import get_file_from_couch

from deepzoom.models import DeepZoom
from deepzoom import deepzoom

from StringIO import StringIO
from datetime import datetime
from xgds_core.couchDbStorage import CouchDbStorage

logger = logging.getLogger("deepzoom.models")
couchStore = CouchDbStorage()
couchDatabase = couchStore.couchDb


def getNewImageFileName(instance, filename):
    return settings.XGDS_IMAGE_DATA_SUBDIRECTORY + filename


class Camera(geocamTrackModels.AbstractResource):
    serial = models.CharField(max_length=128, blank=True, null=True, db_index=True)
    
    """
    Camera class
    """
    pass

DEFAULT_CAMERA_FIELD = lambda: models.ForeignKey(Camera, null=True, blank=True)
DEFAULT_TRACK_POSITION_FIELD = lambda: models.ForeignKey(geocamTrackModels.PastResourcePosition, null=True, blank=True )
DEFAULT_EXIF_POSITION_FIELD = lambda: models.ForeignKey(geocamTrackModels.PastResourcePosition, null=True, blank=True, related_name="%(app_label)s_%(class)s_image_exif_set" )
DEFAULT_USER_POSITION_FIELD = lambda: models.ForeignKey(geocamTrackModels.PastResourcePosition, null=True, blank=True, related_name="%(app_label)s_%(class)s_image_user_set" )
DEFAULT_RESOURCE_FIELD = lambda: models.ForeignKey(geocamTrackModels.Resource, null=True, blank=True)


class DeepZoomImageDescriptor(deepzoom.DZIDescriptor):
    def save(self, destination):
        """Save descriptor file."""
        doc = xml.dom.minidom.Document()
        image = doc.createElementNS(deepzoom.NS_DEEPZOOM, "Image")
        image.setAttribute("xmlns", deepzoom.NS_DEEPZOOM)
        image.setAttribute("TileSize", str(self.tile_size))
        image.setAttribute("Overlap", str(self.tile_overlap))
        image.setAttribute("Format", str(self.tile_format))
        size = doc.createElementNS(deepzoom.NS_DEEPZOOM, "Size")
        size.setAttribute("Width", str(self.width))
        size.setAttribute("Height", str(self.height))
        image.appendChild(size)
        doc.appendChild(image)
        descriptor = doc.toxml()

        f = os.path.basename(destination)
        fpath = os.path.dirname(destination)
        full_file_name = os.path.join(fpath, f)
        couchDatabase[full_file_name] = {"category": "xgds_image", "basename": f, "name": fpath, 
                                         "creation_time": datetime.utcnow().isoformat()}
        newDoc = couchDatabase[full_file_name]
        couchDatabase.put_attachment(newDoc, descriptor, filename=f)


class DeepZoomImageCreator(deepzoom.ImageCreator):
    def create(self, source, destination):
        """Creates Deep Zoom image from source file and saves it to destination."""
        self.image = deepzoom.PILImage.open(source)
        width, height = self.image.size
        self.descriptor = DeepZoomImageDescriptor(width=width,
                                                  height=height,
                                                  tile_size=self.tile_size,
                                                  tile_overlap=self.tile_overlap,
                                                  tile_format=self.tile_format)
        
        #destination = deepzoom._expand(destination)  # path to dzi file: i.e.  /vagrant/xgds_basalt/data/xgds_image/deepzoom_images/p6180021_deepzoom_107/p6180021_deepzoom_107.dzi
        image_name = os.path.splitext(os.path.basename(destination))[0]  # p6180021_deepzoom_107
        dir_name = os.path.dirname(destination)  # i.e. /vagrant/xgds_basalt/data/xgds_image/deepzoom_images/p6180021_deepzoom_107
        image_files = os.path.join(dir_name, "%s_files" % image_name)

        # Create tiles
        levels = self.descriptor.num_levels   # autocalculated from deepzoom DZIDescriptor -- set this in siteSettings
        for level in range(levels):
            level_dir = os.path.join(image_files, str(level))
            level_image = self.get_image(level)
            for (column, row) in self.tiles(level):
                bounds = self.descriptor.get_tile_bounds(level, column, row)
                tile = level_image.crop(bounds)  # these are the tiles that I need to save to couchdb!
                tile_format = self.descriptor.tile_format
                # HERE save the tile to couch db
                tile_name = "%s_%s.%s" % (column, row, tile_format)
                tile_path = level_dir
                full_tile_name = os.path.join(tile_path, tile_name) 
                # save the pil image with BytesIO as the file. and then get the string
                from io import BytesIO
                myIo = BytesIO()
                tile.save(myIo, format='JPEG')
                tileBytesIO = myIo.getvalue()
                # basename and name are for convenience so we can look it up later.
                couchDatabase[full_tile_name] = {"category":"xgds_image", "basename": tile_name,  "name": tile_path,
                             "creation_time": datetime.utcnow().isoformat() }
                newDoc = couchDatabase[full_tile_name]
                couchDatabase.put_attachment(newDoc, tileBytesIO, filename=tile_name)
        self.descriptor.save(destination)
    

class DeepZoomTiles(DeepZoom):
    def create_deepzoom_files(self):
        """
        Creates deepzoom image from associated uploaded image.
        Attempts to load `DEEPZOOM_PARAMS` and `DEEPZOOM_ROOT` from settings.
        Substitutues default settings for any missing settings.
        """
        #Try to load deep zoom parameters, otherwise assign default values.
        try:
            dz_params = settings.DEEPZOOM_PARAMS
        except AttributeError:
            if 'deepzoom.models' in settings.LOGGING['loggers']:
                logger.exception("`DEEPZOOM_PARAMS` incorrectly defined!")
            dz_params = self.DEFAULT_DEEPZOOM_PARAMS

        if not isinstance(dz_params, dict):
            raise AttributeError("`DEEPZOOM_PARAMS` must be a dictionary.")

        _tile_size = self.get_dz_param('tile_size', dz_params)
        _tile_overlap = self.get_dz_param('tile_size', dz_params)
        _tile_format = self.get_dz_param('tile_size', dz_params)
        _image_quality = self.get_dz_param('tile_size', dz_params)
        _resize_filter = self.get_dz_param('tile_size', dz_params)

        #Initialize deep zoom creator.
        creator = DeepZoomImageCreator(tile_size=_tile_size,
                                       tile_overlap=_tile_overlap,
                                       tile_format=_tile_format,
                                       image_quality=_image_quality,
                                       resize_filter=_resize_filter)

        #Try to load deep zoom root, otherwise assign default value.
        try:
            dz_deepzoom_root = settings.DEEPZOOM_ROOT
        except AttributeError:
            dz_deepzoom_root = self.DEFAULT_DEEPZOOM_ROOT

        if not isinstance(dz_deepzoom_root, six.string_types):
            raise AttributeError("`DEEPZOOM_ROOT` must be a string.")
        
        dz_filename = self.slug + ".dzi"
        dz_relative_filepath = os.path.join(dz_deepzoom_root, self.slug)
        dz_couch_destination = os.path.join(dz_relative_filepath, dz_filename)
        
        # getting the associated image
        assoc_image_name = self.associated_image.split('/')[-1]
        dataString = get_file_from_couch(settings.XGDS_IMAGE_DATA_SUBDIRECTORY, assoc_image_name)
        dz_associated_image = StringIO(dataString)

        #Process deep zoom image and save to file system.
        try:
            creator.create(dz_associated_image, dz_couch_destination)  #  source, destination
        except OSError as err:
            print("OS error({0}): {1}".format(err.errno, err.strerror))
        except IOError as err:
            print("I/O error({0}): {1}".format(err.errno, err.strerror))
        except:
            print("Unexpected deep zoom creation error:", sys.exc_info())
            raise

        return(dz_couch_destination, dz_relative_filepath)
    

class AbstractImageSet(models.Model, NoteMixin, SearchableModel, NoteLinksMixin):
    """
    ImageSet is for supporting various resolution images from the same source image.
    Set includes the raw image and any resized images.
    Contains utility functions to fetch different sized images.
    """
    name = models.CharField(max_length=128, default='', blank=True, null=True, help_text="Legible " + settings.XGDS_IMAGE_IMAGE_SET_MONIKER + " name", db_index=True)
    shortName = models.CharField(max_length=32, blank=True, null=True, db_index=True, help_text="a short mnemonic code suitable to embed in a URL")
    camera = 'set this to DEFAULT_CAMERA_FIELD() or similar in derived classes'
    author = models.ForeignKey(User)
    creation_time = models.DateTimeField(blank=True, default=timezone.now, editable=False, db_index=True)
    deleted = models.BooleanField(default=False)
    description = models.CharField(max_length=128, blank=True)
    track_position = 'set this to DEFAULT_TRACK_POSITION_FIELD() or similar in derived classes'
    exif_position = 'set this to DEFAULT_EXIF_POSITION_FIELD() or similar in derived classes'
    user_position = 'set this to DEFAULT_USER_POSITION_FIELD() or similar in derived classes'
    modification_time = models.DateTimeField(blank=True, default=timezone.now, editable=False, db_index=True)
    acquisition_time = models.DateTimeField(editable=False, default=timezone.now, db_index=True)
    acquisition_timezone = models.CharField(null=True, blank=False, max_length=128, default=settings.TIME_ZONE, db_index=True)
    resource = 'set this to DEFAULT_RESOURCE_FIELD() or similar in derived classes'
    #Optionally generate deep zoom from uploaded image if set to True.
    create_deepzoom = models.BooleanField(default= settings.XGDS_IMAGE_DEFAULT_CREATE_DEEPZOOM,
                                          help_text="Generate deep zoom?")   # True if you need to create a deepzoom
    #Link this image to generated deep zoom.
    associated_deepzoom = models.ForeignKey(DeepZoomTiles,
                                            null=True,
                                            blank=True,
                                            related_name="%(app_label)s_%(class)s",
                                            editable=False,
                                            on_delete=models.SET_NULL)
    
    @classmethod
    def timesearchField(self):
        return 'acquisition_time'

    def create_deepzoom_slug(self):
        """
        Returns a string instance for deepzoom slug.
        """
        if self.name:
            try: 
                filename = self.name.split('.')
            except: 
                return ''
            deepzoomSlug = filename[0] + "_deepzoom_" + str(self.id)
            return deepzoomSlug.lower()
    
    
    def create_deepzoom_image(self):
        """
        Creates and processes deep zoom image files to storage.
        Returns instance of newly created DeepZoom instance for associating   
        uploaded image to it.
        """
        try:
            deepzoomSlug = self.create_deepzoom_slug()
            rawImageUrl = self.getRawImage().file.url
            dz, created = DeepZoomTiles.objects.get_or_create(associated_image = rawImageUrl,
                                         name=deepzoomSlug)
            if created: 
                dz.slug = slugify(deepzoomSlug)
                dz.save()
            dz.create_deepzoom_files()
            self.associated_deepzoom = dz
            self.create_deepzoom = False
            self.save()
        except (TypeError, ValueError, AttributeError) as err:
            print("Error: Incorrect deep zoom parameter(s) in settings.py: {0}".format(err))
            raise
        except:
            print("Unexpected error creating deep zoom: {0}".format(sys.exc_info()[1:2]))
            raise
        
 
 
    def delete_image_file(self, path_of_image_to_delete=None):
        """
        Deletes uploaded image file from storage.
        """
        try:
            os.remove(path_of_image_to_delete)
        except OSError:
            logger.exception("Image file deletion failed!")
    
    @classmethod
    def cls_type(cls):
        return 'Photo'
    
    @property
    def raw_image_url(self):
        rawImage = self.getRawImage()
        if rawImage:
            return rawImage.file.url
        return None
    
    @property
    def camera_name(self):
        if self.camera:
            return self.camera.name
        return None

    @property
    def author_name(self):
        return getUserName(self.author)

    @property
    def timezone(self):
        return self.acquisition_timezone

    @property
    def thumbnail_image_url(self):
        thumbImage = self.getThumbnail()
        if thumbImage:
            return thumbImage.file.url
        return ''
    
    @property
    def deepzoom_file_url(self):
        if self.associated_deepzoom:
            deepzoomSlug = self.associated_deepzoom.slug
            docDir = settings.DEEPZOOM_ROOT + deepzoomSlug
            docFile = deepzoomSlug + '.dzi'
            return reverse('get_db_attachment', kwargs={'docDir': docDir,'docName': docFile})
        return None
    
    def finish_initialization(self, request):
        ''' during construction, if you have extra data to fill in you can override this method'''
        pass
        
    class Meta:
        abstract = True
    
    def __unicode__(self):
        return (u"ImageSet(%s, name='%s', shortName='%s')"
                % (self.pk, self.name, self.shortName))
    
    def getPosition(self):
        if self.user_position:
            return self.user_position
        if self.track_position:
            return self.track_position
        if self.exif_position:
            return self.exif_position
        return None
        
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
        
#     def toMapDict(self):
#         """
#         Return a reduced dictionary that will be turned to JSON for rendering in a map
#         """
#         result = modelToDict(self)
#         result['pk'] = int(self.pk)
#         result['app_label'] = self.app_label
#         t = type(self)
#         if t._deferred:
#             t = t.__base__
#         result['model_type'] = t._meta.object_name
#         
#         result['description'] = self.description
#         result['view_url'] = self.view_url
#         result['type'] = 'ImageSet'
#         if self.camera:
#             result['camera_name'] = self.camera.name
#         else:
#             result['camera_name'] = ''
#         result['author_name'] = getUserName(self.author)
#         result['creation_time'] = self.creation_time.strftime("%Y-%m-%d %H:%M:%S UTC")
#         result['acquisition_time'] = self.acquisition_time.strftime("%Y-%m-%d %H:%M:%S UTC")
#         result['timezone'] = self.acquisition_timezone
#         rawImage = self.getRawImage()
#         if rawImage:
#             result['raw_image_url'] = rawImage.file.url
#         result['thumbnail_image_url'] = self.thumbnail_image_url        
#         result['deepzoom_file_url'] = self.deepzoom_file_url
#         if not result['deepzoom_file_url']:
#             result['deepzoom_file_url'] = ''
#         result.update(self.getPositionDict())
#         return result

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
    
    @classmethod
    def getSearchableFields(self):
        return ['name', 'description', 'author__first_name', 'author__last_name']


class ImageSet(AbstractImageSet):
    # set foreign key fields from parent model to point to correct types
    camera = DEFAULT_CAMERA_FIELD()
    track_position = DEFAULT_TRACK_POSITION_FIELD()
    exif_position = DEFAULT_EXIF_POSITION_FIELD()
    user_position = DEFAULT_USER_POSITION_FIELD()
    resource = DEFAULT_RESOURCE_FIELD()


DEFAULT_IMAGE_SET_FIELD = lambda: models.ForeignKey(ImageSet, null=True, related_name="images")

couchStore = CouchDbStorage()


class AbstractSingleImage(models.Model):
    """ 
    An abstract image which may not necessarily have a location on a map
    """
    file = models.ImageField(upload_to=getNewImageFileName,
                             max_length=255, storage=couchStore)
    creation_time = models.DateTimeField(blank=True, default=timezone.now, editable=False, db_index=True)
    raw = models.BooleanField(default=True)
    imageSet = 'set this to DEFAULT_IMAGE_SET_FIELD() or similar in derived models'
    thumbnail = models.BooleanField(default=False)
       
#     def toMapDict(self):
#         """
#         Return a reduced dictionary that will be turned to JSON
#         """
#         result = modelToDict(self)
#         return result
    
    class Meta:
        abstract = True
        ordering = ['-creation_time']

    def __unicode__(self):
        return self.file.name
        

class SingleImage(AbstractSingleImage):
    """ This can be used for screenshots or non geolocated images 
    """
    # set foreign key fields from parent model to point to correct types
    imageSet = DEFAULT_IMAGE_SET_FIELD()
    
    



