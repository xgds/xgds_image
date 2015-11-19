/*
 * Image drag and drop upload
 */
var MAX_NUM_THUMBNAILS = 5;
var filesEnqueuedIcon = null;

Dropzone.options.imageDropZone = {
	// Prevents Dropzone from uploading dropped files immediately
	autoProcessQueue : false,
	parallelUploads: 1000, // upload up to 1000 images in parallel
	addRemoveLinks: true,
	acceptedFiles: ".png,.jpg,.jpeg,.tif,.tiff,.gif,.pdf",
	init : function() {
		var submitButton = document.querySelector("#submit-all")
		imageDropZone = this;
		// display message showing number of files enqueued
		filesEnqueuedMessage = document.createElement("div");
		filesEnqueuedMessage.innerHTML = "<strong> Files enqueued: </strong> " + this.files.length; 
		this.previewsContainer.appendChild(filesEnqueuedMessage);
		
		// process files when submit is clicked.
		submitButton.addEventListener("click", function() {
			imageDropZone.processQueue();  // Tell Dropzone to process all queued files.
		});
		
		this.on("reset", function() {
			// reset the files enqueued message.
			filesEnqueuedMessage.innerHTML = "<strong> Files enqueued: </strong> " + 0;
			// reset error msg (TODO: handle files that didn't failed on upload")
			$(".upload-error").html("");
		})
		
		this.on("addedfile", function(file) {
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
				filesEnqueuedMessage.innerHTML = "<strong> Files enqueued: </strong> " + this.files.length; 
			}
		});
		this.on("complete", function(file) {
			// automatically remove a file when it’s finished uploading
			this.removeFile(file); 
		});
		
		this.on("success", function(file, responseText, e) {
			var json = responseText['json'];
			var imageTable = $('#image_table'); 
			theDataTable.fnAddData(json);	
			app.vent.trigger("mapSearch:found", theDataTable.fnGetData());
		});
		
		this.on("error", function(file, response) {
			$(".upload-error").append(file.name +"   - "+ file.status + ": " + response + "<br />");
		});
	}
};