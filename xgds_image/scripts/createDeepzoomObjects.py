import django
import traceback
django.setup()

from django.conf import settings
from geocamUtil.loader import LazyGetModelByName

from xgds_image.models import DeepZoomTiles

IMAGE_SET_MODEL = LazyGetModelByName(settings.XGDS_IMAGE_IMAGE_SET_MODEL)

allImageSets = IMAGE_SET_MODEL.get().objects.all()


"""
Find imagesets that does not have associated_deepzoom. 
For each of these imagesets, 
1) create a new DeepZoomTile object,
2) link DZT obj to to the image set
3) set create_deepzoom to False.
"""

for imageset in allImageSets:
    if not imageset.associated_deepzoom:
        try:
            print 'about to create deepzoom for ' + imageset.name
            dzt = imageset.create_deepzoom_image() 
        except:
            traceback.print_exc()
