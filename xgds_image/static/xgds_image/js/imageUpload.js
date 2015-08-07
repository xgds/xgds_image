// images table
defaultOptions["columnDefs"] = [{ "width": "150", "targets": 0 }];
var imageTable = $(image_table).DataTable(defaultOptions);

// give path, construct an html link
function createLink(path) {
	return "<a href='" + path + "'>" + path + "</a>"
}

// add rows to the table on page load.
$(images).each(function(){
	var imageUrl = createLink(this['imageUrl']);
	imageTable.row.add([imageUrl, this['creation_time'], 'dummy source', 
	                    'dummy lat', 'dummy lon', 'dummy alt']).draw();
});


// image dropzone
Dropzone.options.imageDropZone = {
	// Prevents Dropzone from uploading dropped files immediately
	autoProcessQueue : false,

//	acceptedFiles: 'application/image',
	init : function() {
		var submitButton = document.querySelector("#submit-all")
		imageDropZone = this;

		submitButton.addEventListener("click", function() {
			imageDropZone.processQueue();  // Tell Dropzone to process all queued files.
		});

		// You might want to show the submit button only when
		// files are dropped here:
		this.on("addedfile", function() {
			// Show submit button here and/or inform user to click it.
		});
		
		this.on("success", function(file, responseText, e) {
			imageJson = responseText['json'];
			var imageUrl = createLink(imageJson['imageUrl']);
			imageTable.row.add([imageUrl, imageJson['creation_time'], 'dummy source', 
			                    'dummy lat', 'dummy lon', 'dummy alt']).draw();
		});
	}
};


