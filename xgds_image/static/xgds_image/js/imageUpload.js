// images table
defaultOptions["columnDefs"] = [{ "width": "150", "targets": 0 }];
var imageTable = $(image_table).DataTable(defaultOptions);

$(images).each(function(){
	var imageUrl = "<a href='" + this['imageUrl'] + "'>" + this['imageUrl'] + "</a>"
	imageTable.row.add([imageUrl, this['creation_time'], 'dummy source', 'dummy lat', 'dummy lon', 'dummy alt' ]).draw();
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
		
		this.on("success", function(file, responseText, e){
			console.log("RESPONSE TEXT: ", responseText);
			// call your method to take the json data out of responseText and put it in the table
			// add new rows to table.
			// clear the dropzone.
		});
	}
};


