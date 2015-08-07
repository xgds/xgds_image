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

import json
from django.shortcuts import render_to_response
from django.http import HttpResponseRedirect, HttpResponseForbidden, Http404, HttpResponse
from django.template import RequestContext
from django.utils.translation import ugettext, ugettext_lazy as _
from django.core.urlresolvers import reverse
from models import SingleImage
from forms import UploadFileForm


def getImageUploadPage(request):
    images = SingleImage.objects.all()  # @UndefinedVariable
    uploadedImages = [json.dumps(image.toMapDict()) for image in images]
    data = {'dropzoneImageUrl': reverse('xgds_dropzone_image'),
            'uploadedImages': uploadedImages}
    return render_to_response("xgds_image/imageUpload.html", data,
                              context_instance=RequestContext(request))
    
def getImageSearchPage(request):
    return render_to_response("xgds_image/imageSearch.html", {},
                              context_instance=RequestContext(request))
    
def dropzoneImage(request):
    """
    Image drag and drop, save to database.
    TODO make sure this method handles multiple files uploaded at once
    """
    if request.method == 'POST':
        form = UploadFileForm(request.POST, request.FILES)
        if form.is_valid():
            new_file = SingleImage(file = request.FILES['file'])
            new_file.save()
            # RETURN THE UPLOADED IMAGE AS JSON (toMapDict())
            return HttpResponse(json.dumps({'success': 'true'}), 
                                content_type='application/json')
        else: 
            print "FORM ERRORS"
            print form.errors
            return HttpResponse(json.dumps({'error': 'Uploaded image is not valid'}), content_type='application/json')
    else:
        form = UploadFileForm()
        data = {'form': form}
        return render_to_response('xgds_image/imageUpload.html', 
                                  data, context_instance=RequestContext(request))
        