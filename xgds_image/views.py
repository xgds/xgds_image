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

import glob
import json
import os
from django.shortcuts import render_to_response
from django.http import HttpResponseRedirect, HttpResponseForbidden, Http404, HttpResponse
from django.template import RequestContext
from django.utils.translation import ugettext, ugettext_lazy as _
from django.core.urlresolvers import reverse
from models import SingleImage
from forms import UploadFileForm
from xgds_image import settings


def get_handlebars_templates(source):
    global _template_cache
    if settings.XGDS_IMAGE_TEMPLATE_DEBUG or not _template_cache:
        templates = {}
        for thePath in source:
            inp = os.path.join(settings.PROJ_ROOT, 'apps', thePath)
            for template_file in glob.glob(os.path.join(inp, '*.handlebars')):
                with open(template_file, 'r') as infile:
                    template_name = os.path.splitext(os.path.basename(template_file))[0]
                    templates[template_name] = infile.read()
        _template_cache = templates
    return _template_cache


def getImageUploadPage(request):
    #TODO: filter the SingleImage so that it lists users's uploaded images.
    images = SingleImage.objects.all()  # @UndefinedVariable
    uploadedImages = [json.dumps(image.toMapDict()) for image in images]
    templates = get_handlebars_templates(settings.XGDS_IMAGE_HANDLEBARS_DIR)
    data = {'uploadedImages': uploadedImages,
            'templates': templates}
    return render_to_response("xgds_image/imageUpload.html", data,
                              context_instance=RequestContext(request))

    
def getImageSearchPage(request):
    return render_to_response("xgds_image/imageSearch.html", {},
                              context_instance=RequestContext(request))
    

def saveImage(request):
    """
    Image drag and drop, saves the files and to the database.
    """
    if request.method == 'POST':
        form = UploadFileForm(request.POST, request.FILES)
        if form.is_valid():
            new_file = SingleImage(file = request.FILES['file'])
            new_file.save()
            # pass the uploaded image to front end as json.
            new_file_json = new_file.toMapDict() 
            return HttpResponse(json.dumps({'success': 'true', 'json': new_file_json}), 
                                content_type='application/json')

        else: 
            return HttpResponse(json.dumps({'error': 'Uploaded image is not valid'}), content_type='application/json')     