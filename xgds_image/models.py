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

from enum import Enum
import os
import logging
import sys
import six
import xml.dom.minidom

from django.db import models
from django.conf import settings
from django.contrib.auth.models import User
from django.core.exceptions import ObjectDoesNotExist
from django.core.urlresolvers import reverse
from django.core.validators import MaxValueValidator, MinValueValidator
from django.forms.models import model_to_dict
from django.utils import timezone
from django.utils.text import slugify
from django.urls import reverse

from geocamUtil.models import AbstractEnumModel
from geocamUtil.loader import LazyGetModelByName, getClassByName
from geocamUtil.defaultSettings import HOSTNAME
from geocamUtil.modelJson import modelToDict
from geocamUtil.UserUtil import getUserName
from geocamTrack import models as geocamTrackModels

from xgds_notes2.models import NoteMixin, NoteLinksMixin, DEFAULT_NOTES_GENERIC_RELATION
from xgds_core.couchDbStorage import CouchDbStorage
from xgds_core.models import SearchableModel, AbstractVehicle, HasFlight, HasDownloadableFiles, IsFlightChild, \
    IsFlightData
from xgds_core.views import get_file_from_couch

from deepzoom.models import DeepZoom
from deepzoom import deepzoom

from StringIO import StringIO
from datetime import datetime
from xgds_core.couchDbStorage import CouchDbStorage
from email.mime import image
import couchdb

logger = logging.getLogger("deepzoom.models")
# This global declaration does not work when the database name has to be changed
# at run time (e.g. when running unit tests), so the global declaration has been
# moved to a couple places where it is needed here and may need to be fixed
# elsewhere if the change has other unintended and undetected consequences
# couchStore = CouchDbStorage()
# couchDatabase = couchStore.get_couchDb()


def getNewImageFileName(instance, filename):
    return settings.XGDS_IMAGE_DATA_SUBDIRECTORY + filename


class ImageType(Enum):
    """
    Definitions of image type here.
    Currently this will include:
     SOURCE, for images which get converted.
     FULL, for images which are full size renderable
     THUMBNAIL, renderable thumbnail images
    """
    full = 0
    source = 1
    thumbnail = 2


class Camera(AbstractVehicle):
    """
    Camera class
    """
    serial = models.CharField(max_length=128, blank=True, null=True)
    name = models.CharField(max_length=64, blank=True)
    heading_offset_degrees = models.FloatField(default=0, validators=[MinValueValidator(-360.0), MaxValueValidator(360.0)])

    class Meta:
        unique_together = ("name", "serial")


# TODO change these in your model classes if you are not using defaults
DEFAULT_CAMERA_FIELD = lambda: models.ForeignKey(Camera, null=True, blank=True)

DEFAULT_TRACK_POSITION_FIELD = lambda: models.ForeignKey(settings.GEOCAM_TRACK_PAST_POSITION_MODEL, null=True, blank=True, related_name="%(app_label)s_%(class)s_image_track_set"  )
DEFAULT_EXIF_POSITION_FIELD = lambda: models.ForeignKey(settings.GEOCAM_TRACK_PAST_POSITION_MODEL, null=True, blank=True, related_name="%(app_label)s_%(class)s_image_exif_set" )
DEFAULT_USER_POSITION_FIELD = lambda: models.ForeignKey(settings.GEOCAM_TRACK_PAST_POSITION_MODEL, null=True, blank=True, related_name="%(app_label)s_%(class)s_image_user_set" )
DEFAULT_FLIGHT_FIELD = lambda: models.ForeignKey('xgds_core.Flight', related_name='%(app_label)s_%(class)s_related',
                                                 verbose_name=settings.XGDS_CORE_FLIGHT_MONIKER, blank=True, null=True)
# TODO if you are not using the default image set model you will have to override this in your classes
DEFAULT_IMAGE_SET_FIELD = lambda: models.ForeignKey('xgds_image.ImageSet', related_name='%(app_label)s_%(class)s_related',
                                                    verbose_name=settings.XGDS_IMAGE_IMAGE_SET_MONIKER, blank=True, null=True)


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
        #################
        # these were global, now defined locally:
        couchStore = CouchDbStorage()
        couchDatabase = couchStore.get_couchDb()
        #################
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
                #################
                # these were global, now defined locally:
                couchStore = CouchDbStorage()
                couchDatabase = couchStore.get_couchDb()
                #################
                couchDatabase[full_tile_name] = {"category":"xgds_image",
                                                 "basename": tile_name,
                                                 "name": tile_path,
                                                 "creation_time": datetime.utcnow().isoformat()}
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
    

class AbstractImageSet(models.Model, NoteMixin, SearchableModel, NoteLinksMixin, HasFlight, HasDownloadableFiles, IsFlightChild, IsFlightData):
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
    uploadAndSaveTime = models.FloatField(null=True, blank=True)
    totalTimeSinceNotify = models.FloatField(null=True, blank=True)
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
    rotation_degrees = models.PositiveSmallIntegerField(null=True, default=0)
    flight = "TODO set to DEFAULT_FLIGHT_FIELD or similar"

    @classmethod
    def get_tree_json(cls, parent_class, parent_pk):
        try:
            found = LazyGetModelByName(settings.XGDS_IMAGE_IMAGE_SET_MODEL).get().objects.filter(flight__id=parent_pk)
            result = None
            if found.exists():
                moniker = settings.XGDS_IMAGE_IMAGE_SET_MONIKER + 's'
                flight = found[0].flight
                result = [{"title": moniker,
                           "selected": False,
                           "tooltip": "%s for %s " % (moniker, flight.name),
                           "key": "%s_%s" % (flight.uuid, moniker),
                           "data": {"json": reverse('xgds_map_server_objectsJson',
                                                    kwargs={'object_name': 'XGDS_IMAGE_IMAGE_SET_MODEL',
                                                            'filter': 'flight__pk:' + str(flight.pk)}),
                                    "sseUrl": "",
                                    "type": 'MapLink',
                                    }
                           }]
            return result
        except ObjectDoesNotExist:
            return None

    @classmethod
    def get_info_json(cls, flight_pk):
        found = LazyGetModelByName(settings.XGDS_IMAGE_IMAGE_SET_MODEL).get().objects.filter(flight__id=flight_pk)
        result = None
        if found.exists():
            flight = LazyGetModelByName(settings.XGDS_CORE_FLIGHT_MODEL).get().objects.get(id=flight_pk)
            result = {'name': settings.XGDS_IMAGE_IMAGE_SET_MONIKER + 's',
                      'count': found.count(),
                      'url': reverse('search_map_object_filter', kwargs={'modelName':settings.XGDS_IMAGE_IMAGE_SET_MONIKER,
                                                                         'filter': 'flight__group:%d,flight__vehicle:%d' % (
                                                                         flight.group.pk, flight.vehicle.pk)})
                      }
        return result


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
            dz, created = DeepZoomTiles.objects.get_or_create(associated_image=rawImageUrl,
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
        # finally:
            # Mark the thread inactive in the couchdb in case there's another
            # thread waiting for this to be finished
            # TODO: come up with a better multithreaded way to do this
            # dbServer = couchdb.Server()
            # db = dbServer[settings.COUCHDB_FILESTORE_NAME]
            # myFlag = db['create_deepzoom_thread']
            # myFlag['active'] = False
            # db['create_deepzoom_thread'] = myFlag


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
    def originalImageResolutionString(self):
        originalImage = self.getRawImage()
        if originalImage:
            width = originalImage.width
            height = originalImage.height

            if width and height:
                megaPixels = (width * height)/(1000.0*1000.0)
                return "%1d x %1d | %1.2f MP" % (width, height, megaPixels)
        return 'n/a'

    @property
    def originalImageFileSizeMB(self):
        originalImage = self.getRawImage()
        if originalImage and originalImage.fileSizeBytes:
            fileSizeMB = "%1.2f MB" % (originalImage.fileSizeBytes/(1024.0*1024.0))
            return fileSizeMB
        return 'n/a'

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
        """ during construction, if you have extra data to fill in you can override this method"""
        pass
        
    class Meta:
        abstract = True
    
    def __unicode__(self):
        return (u"ImageSet(%s, name='%s', shortName='%s')"
                % (self.pk, self.name, self.shortName))
    
    def getPosition(self):
        if self.user_position:
            return self.user_position
        if self.exif_position:
            return self.exif_position
        if self.track_position:
            return self.track_position
        return None

    @property
    def head(self):
        """ heading """
        try:
            position = self.getPosition()
            if position:
                if self.camera:
                    return position.heading + self.camera.heading_offset_degrees
                return position.heading
        except:
            pass
        return None
        
    def getPositionDict(self):
        """ override if you want to change the logic for how the positions are prioritized in JSON.
        Right now exif_position is from the camera, track_position is from the track, and user_position stores any hand edits.
        track provides lat lon and altitude, exif provides heading, and user trumps all.
        """
        result = {}
        result['alt'] = ""
        result['head'] = ""

        heading_offset_degrees = 0
        if self.camera:
            heading_offset_degrees = self.camera.heading_offset_degrees

        if self.user_position:
            result['lat'] = self.user_position.latitude
            result['lon'] = self.user_position.longitude
            if hasattr(self.user_position, 'altitude'):
                result['alt'] = self.user_position.altitude
            if hasattr(self.user_position, 'heading'):
                result['head'] = self.user_position.heading + heading_offset_degrees
            return result
        
        result['position_id'] = ""
        if self.track_position:
            result['lat'] = self.track_position.latitude
            result['lon'] = self.track_position.longitude
            if self.track_position.altitude:
                result['alt'] = self.track_position.altitude
            if hasattr(self.track_position, 'heading'):
                result['head'] = self.track_position.heading + heading_offset_degrees
            if result['alt'] == '' and hasattr(self.exif_position, 'altitude'):
                result['alt'] = self.track_position.altitude
            return result

        elif self.exif_position:
            result['lat'] = self.exif_position.latitude
            result['lon'] = self.exif_position.longitude
            if hasattr(self.exif_position, 'altitude'):
                result['alt'] = self.exif_position.altitude
            if hasattr(self.exif_position, 'heading'):
                result['head'] = self.exif_position.heading + heading_offset_degrees
        else: 
            result['lat'] = ""
            result['lon'] = ""
            
        return result
        
    def getRawImage(self):
        rawImages = self.images.filter(raw=True)
        if rawImages:
            return rawImages[0]
        else:
            return None

    def getSourceImage(self):
        sourceImages = self.images.filter(imageType=ImageType.source.value)
        if sourceImages:
            return sourceImages[0]
        else:
            return None

    def getDownloadableFiles(self):
        """
        :return: list of file objects, each with their own `read()` functions
        """
        sourceImage = self.getSourceImage()
        if sourceImage:
            return [sourceImage.file]
        return [self.getRawImage().file]

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
        return ['name', 'description', 'author__first_name', 'author__last_name', 'flight__name']
    
    @classmethod
    def getSearchFormFields(cls):
        return ['name',
                'description',
                'author',
                'camera',
                'flight__vehicle'
                ]
    
    @classmethod
    def getSearchFieldOrder(cls):
        return ['flight__vehicle',
                'author',
                'name',
                'description',
                'camera',
                'acquisition_timezone',
                'min_acquisition_time',
                'max_acquisition_time']


class ImageSet(AbstractImageSet):
    # set foreign key fields from parent model to point to correct types
    camera = DEFAULT_CAMERA_FIELD()
    track_position = DEFAULT_TRACK_POSITION_FIELD()
    exif_position = DEFAULT_EXIF_POSITION_FIELD()
    user_position = DEFAULT_USER_POSITION_FIELD()
    notes = DEFAULT_NOTES_GENERIC_RELATION()
    flight = DEFAULT_FLIGHT_FIELD()


couchStore = CouchDbStorage()


class AbstractSingleImage(models.Model):
    """ 
    An abstract image which may not necessarily have a location on a map
    """
    file = models.ImageField(upload_to=getNewImageFileName,
                             max_length=256, storage=couchStore)
    creation_time = models.DateTimeField(blank=True, default=timezone.now, editable=False, db_index=True)
    raw = models.BooleanField(default=True)
    imageSet = 'set this to DEFAULT_IMAGE_SET_FIELD() or similar in derived models'
    thumbnail = models.BooleanField(default=False)
    width = models.IntegerField(blank=True, null=True)
    height = models.IntegerField(blank=True, null=True)
    fileSizeBytes = models.IntegerField(blank=True, null=True)
    imageType = models.IntegerField(blank=True, null=True)

    @property
    def acquisition_time(self):
        return self.imageSet.acquisition_time

#     def toMapDict(self):
#         """
#         Return a reduced dictionary that will be turned to JSON
#         """
#         result = modelToDict(self)
#         return result

    def getAnnotations(self):
        return ANNOTATION_MANAGER.filter(image__pk=self.pk)

    class Meta:
        abstract = True
        ordering = ['-creation_time']

    def __unicode__(self):
        return self.file.name
        

class SingleImage(AbstractSingleImage):
    """ This can be used for screenshots or non geolocated images 
    """
    # set foreign key fields from parent model to point to correct types
    imageSet = models.ForeignKey(settings.XGDS_IMAGE_IMAGE_SET_MODEL, related_name='images',
                                 verbose_name=settings.XGDS_IMAGE_IMAGE_SET_MONIKER, blank=True, null=True)
    

DEFAULT_SINGLE_IMAGE_FIELD = lambda: models.ForeignKey(settings.XGDS_IMAGE_SINGLE_IMAGE_MODEL, related_name="image")


class AnnotationColor(models.Model):
    name = models.CharField(max_length=16, db_index=True)
    hex = models.CharField(max_length=16)


class AbstractAnnotation(models.Model):
    left = models.IntegerField(null=False, blank=False)
    top = models.IntegerField(null=False, blank=False)
    strokeColor = models.ForeignKey(AnnotationColor, related_name='%(app_label)s_%(class)s_strokeColor', default=1)
    strokeWidth = models.PositiveIntegerField(default=2)
    angle = models.FloatField(default=0)  # store shape rotation angle
    scaleX = models.FloatField(default=1)
    scaleY = models.FloatField(default=1)
    originX = models.CharField(max_length=16, default="left")
    originY = models.CharField(max_length=16, default="center")
    fill = models.ForeignKey(AnnotationColor, related_name='%(app_label)s_%(class)s_fill', null=True, blank=True)
    size = models.CharField(max_length=16, default="medium")

    author = models.ForeignKey(User, related_name='%(app_label)s_%(class)s_related')
    creation_time = models.DateTimeField(blank=True, default=timezone.now, editable=False, db_index=True)
    image = 'set this to DEFAULT_SINGLE_IMAGE_FIELD or similar in derived classes'
    # WARNING -- you cannot include the below in this class or it will cause a circular dependency in migrations
    #image = models.ForeignKey(settings.XGDS_IMAGE_IMAGE_SET_MODEL, related_name='%(app_label)s_%(class)s_image')  

    class Meta:
        abstract = True

    def getJsonType(self):
        return 'Annotation'

    def toJson(self):
        result = model_to_dict(self)
        result['annotationType'] = self.getJsonType()
        result['pk'] = self.pk
        return result


class NormalAnnotation(AbstractAnnotation):
    """ The default type of annotation, referring to an xgds_image.ImageSet """
    image = DEFAULT_IMAGE_SET_FIELD()

    class Meta:
        abstract = True


class AbstractTextAnnotation(models.Model):
    content = models.CharField(max_length=512, default='')
    isBold = models.BooleanField(default=False)
    isItalics = models.BooleanField(default=False)
    width = models.PositiveIntegerField(default=1)
    height = models.PositiveIntegerField(default=1)

    def getJsonType(self):
        return 'Text'

    class Meta:
        abstract = True


class TextAnnotation(AbstractTextAnnotation, NormalAnnotation):
    pass


class AbstractEllipseAnnotation(models.Model):
    radiusX = models.IntegerField()
    radiusY = models.IntegerField()

    def getJsonType(self):
        return 'Ellipse'

    class Meta:
        abstract = True


class EllipseAnnotation(AbstractEllipseAnnotation, NormalAnnotation):
    pass


class AbstractRectangleAnnotation(models.Model):
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()

    def getJsonType(self):
        return 'Rectangle'

    class Meta:
        abstract = True


class RectangleAnnotation(AbstractRectangleAnnotation, NormalAnnotation):
    pass


class AbstractArrowAnnotation(models.Model):
    points = models.TextField(default='[]')

    def getJsonType(self):
        return 'Arrow'

    class Meta:
        abstract = True


class ArrowAnnotation(AbstractArrowAnnotation, NormalAnnotation):
    pass

# NOT USED YET
# This will support the url to the saved annotated image download via url
# class AnnotatedScreenshot(models.Model):
#     imageBinary = models.FileField(upload_to=settings.XGDS_IMAGE_ANNOTATED_IMAGES_SUBDIR)
#     width = models.PositiveIntegerField(default=250)
#     height = models.PositiveIntegerField(default=250)
#     author = models.ForeignKey(User)
#     creation_time = models.DateTimeField(blank=True, default=timezone.now, editable=False, db_index=True)
#     image = 'set this to DEFAULT_SINGLE_IMAGE_FIELD or similar in derived classes'
#     # WARNING -- the below will cause a circular dependency so don't do it.  You have to have a derived class if you are planning to use this.  
#     #image = models.ForeignKey(settings.XGDS_IMAGE_IMAGE_SET_MODEL, related_name='%(app_label)s_%(class)s_image')  # DEFAULT_SINGLE_IMAGE_FIELD # 'set this to DEFAULT_SINGLE_IMAGE_FIELD or similar in derived classes'

