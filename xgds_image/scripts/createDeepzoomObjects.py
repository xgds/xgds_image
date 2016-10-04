import django
import traceback
django.setup()

from basaltApp.models import BasaltImageSet
from xgds_image.models import DeepZoomTiles

allImageSets = BasaltImageSet.objects.all()

#TODO: REFACTOR INTO XGDS_IMAGE SCRIPTS.  (use lazy get model)

"""
Find imagesets that does not have associated_deepzoom. 
For each of these imagesets, 
1) create a new DeepZoomTile object,
2) link DZT obj to to the image set
3) set create_deepzoom to False.
"""

for imageset in allImageSets:
    if (imageset.associated_deepzoom) == None:
        try:
            print 'about to create deepzoom for ' + imageset.name
            dzt = imageset.create_deepzoom_image() 
        except:
            traceback.print_exc()
