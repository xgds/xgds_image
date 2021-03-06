//__BEGIN_LICENSE__
// Copyright (c) 2015, United States Government, as represented by the
// Administrator of the National Aeronautics and Space Administration.
// All rights reserved.
//
// The xGDS platform is licensed under the Apache License, Version 2.0
// (the "License"); you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// http://www.apache.org/licenses/LICENSE-2.0.
//
// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.
//__END_LICENSE__

/*
 * Image drag and drop upload
 */
var MAX_NUM_THUMBNAILS = 4;
var filesEnqueuedIcon = null;
var lastModDate = [];

Dropzone.options.imageDropZone = {
	// Prevents Dropzone from uploading dropped files immediately
	autoProcessQueue : false,
	parallelUploads: 1, // upload up to 1000 images in parallel
	addRemoveLinks: true,
	acceptedFiles: ".png,.jpg,.jpeg,.tif,.tiff,.gif,.pdf",
	dictDefaultMessage: 'Drop files here to upload, or click for file browser.',
	init : function() {
		var submitButton = document.querySelector("#submit-all")
		imageDropZone = this;

		// display message showing number of files enqueued
		$("#enqueued_count").html = this.files.length;
		
		// process files when submit is clicked.
		submitButton.addEventListener("click", function() {
			imageDropZone.options.headers = { 'lastMod': lastModDate};
		    imageDropZone.options.autoProcessQueue = true;
			imageDropZone.processQueue();  // Tell Dropzone to process all queued files.
		});
		
		this.on("reset", function() {
			// reset the files enqueued message.
			$("#enqueued_count").html = 0;
			
			// reset error msg (TODO: handle files that didn't failed on upload")
			$(".upload-error").html("");
		});
		
		this.on("addedfile", function(file) {
			lastModDate.push(file.name + "||" + file.lastModified);
			if (this.files.length == MAX_NUM_THUMBNAILS) {
				filesEnqueuedIcon = file;
			}
			if (this.files.length > MAX_NUM_THUMBNAILS) {
				// if there are more than four files uploaded at once, don't display them as thumbnails.
				this.previewsContainer.removeChild(file.previewElement);
				// update icon to show number of files enqueued
				var numAdditionalFiles = this.files.length - MAX_NUM_THUMBNAILS + 1;
				filesEnqueuedIcon.previewElement.innerHTML = "<div class='dz-image more-files-enqueued-icon'>" +
				"<div class='num-files-enqueued-text'> <strong> +" +
				numAdditionalFiles + 
				" files </strong></div>" + 
				"</div>";
				// update message to show number of files enqueued.
				$("#enqueued_count").html = this.files.length;
			}
		});
		// this.on("complete", function(file) {
		// 	// automatically remove a file when it’s finished uploading
		// 	this.removeFile(file); 
		// 	this.lastModDate = [];
		// });
		
		this.on("success", function(file, responseText, e) {
			var json = responseText['json'];
			theDataTable.fnAddData(json);
			imageSetsArray.push(json);
			app.vent.trigger("mapSearch:found", theDataTable.fnGetData());
		});
		
		this.on("error", function(file, response) {
			$(".upload-error").append(file.name +"   - "+ file.status + ": " + response + "<br />");
		});
	}
};
