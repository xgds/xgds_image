    var prefixUrl = '/static/openseadragon/built-openseadragon/openseadragon/images/';
    var viewer = OpenSeadragon({
        id:            "openseadragon1",
        prefixUrl:     prefixUrl,
        showNavigator: false,
        gestureSettingsMouse:   {
            clickToZoom: false
        },
        clickToZoom: "false",
        tileSources:   [{
            Image:  {
                //Need to change [tile_format="jpg", image_quality=0.85,]
                //Plus any other changes in deepzoom.py we make
                xmlns: "http://schemas.microsoft.com/deepzoom/2009",
                Url: "../../../../data/images/spacePics/ISS044-E-1998_files/",
                TileSize: "128",
                Overlap: "2",
                Format: "png",
                ServerFormat: "Default",
                Size: {
                    Width: "4928",
                    Height: "3280",
                }
            }
        }],
    });

    //fabricjs-openseadragon annotation object
    var overlay = viewer.fabricjsOverlay();
    var arrow, line, rectangle, circle, ellipse, text, isDown, textboxPreview, origX, origY;
    var currentAnnotationType = "arrow"; //stores the type of the current annotation being drawn so we know which varaible (arrow/line/rectangle/ellipse/text etc) to serialize on mouse:up

    /*
    Stores annotation primary key to annotation json mappings for all annotations currently drawn on the canvas {pk: annotation json}
    Used to check if an annotation is on the canvas to prevent duplicate loadAnnotations() calls from the user
     */
    var annotationsDict = {};

    /* the mouse can be in 3 modes:
        1.) OSD (for interaction w/ OSD viewer, drag/scroll/zoom around the map
        2.) addAnnotation (disable OSD mode and enable click/drag on fabricJS canvas to draw an annotation)
        3.) editAnnotation (disable OSD mode and allow editing of existing annotations (but do not draw on clicK)
        getters and setters are below
     */
    var mouseMode = "OSD";

    /*
    Annotation type we draw on canvas on click (arrow on default), changed by #annotationType
     */
    var annotationType = "arrow";

    // addRectToCanvas(1000, 1000);

    //Euclidean distance between (x1,y1) and (x2,y2)
    function distanceFormula(x1, y1, x2, y2) {
        var xDist = Math.pow((x1-x2),2);
        var yDist = Math.pow((y1-y2),2);
        return Math.sqrt(xDist+yDist);
    }

    function initializeLine(x, y) {
        line = new fabric.Line([x, y, x, y], {
            left: x,
            top: y,
            stroke: "red",
            strokeWidth: 15,
            originX: 'center',
            originY: 'center',
            type: 'line'
        });
        currentAnnotationType = line;
        overlay.fabricCanvas().add(line)
    }

    function updateLineEndpoint(x, y) {
        line.set({x2:x, y2:y});
        currentAnnotationType = line;
    }

    function initializeEllipse(x, y) {
        ellipse = new fabric.Ellipse({
            left: x,
            top: y,
            radius: 1,
            strokeWidth: 1,
            stroke: 'black',
            fill: 'white',
            selectable: true,
            originX: 'center',
            originY: 'center',
            type: 'ellipse'
        });
        currentAnnotationType = ellipse
        overlay.fabricCanvas().add(ellipse);
    }

    function updateEllipse(x, y) {
        var distance = distanceFormula(x,y,origX,origY);
        ellipse.set({rx: Math.abs(origX-x), ry:Math.abs(origY-y)});
        currentAnnotationType = ellipse
    }

    function initializeCircle(x, y) {
        circle = new fabric.Circle({
            left: x,
            top: y,
            radius: 1,
            strokeWidth: 1,
            stroke: 'black',
            fill: 'white',
            selectable: true,
            originX: 'center',
            originY: 'center',
            type: 'circle'
        });
        currentAnnotationType = circle;
        overlay.fabricCanvas().add(circle);
    }

    //TODO: should I update the circle member variable automatically or pass in the object to modify?
    function updateCircleRadius(x, y, origX, origY) {
        var radius = distanceFormula(x, y, origX, origY);
        circle.set({radius: radius});
        currentAnnotationType = circle;
    }

    function initializeRectangle(x, y) {
        rectangle = new fabric.Rect({
            left: x,
            top: y,
            fill: 'blue',
            width: 1,
            height: 1,
            type: 'rect'
        });
        currentAnnotationType = rectangle;
        overlay.fabricCanvas().add(rectangle);
    }

    function updateRectangleWidth(x, y) {
        var width = Math.abs(x-origX);
        var height = Math.abs(y-origY);
        rectangle.set({width: width, height: height});
        currentAnnotationType=rectangle;
    }

    function initializeTextboxPreview(x, y) {
        textboxPreview = new fabric.Rect({
            left: x,
            top: y,
            fill: "",
            strokeWidth: 5,
            stroke: 'black',
            width: 1,
            height: 1,
            type: 'textboxPreview'
        });

        currentAnnotationType = textboxPreview;
        overlay.fabricCanvas().add(textboxPreview);
    }

    function updateTextboxPreview(x, y) {
        var width = Math.abs(x-origX);
        var height = Math.abs(y-origY);
        textboxPreview.set({width: width, height: height});
        currentAnnotationType = textboxPreview
    }
    function initializeText(x, y) {
        text = new fabric.Textbox('MyText', {
            width: 150,
            top: y,
            left: x,
            fontSize: 100,
            textAlign: 'center'
        }); //TODO: remove the fixed width stuff
        currentAnnotationType=text;
        overlay.fabricCanvas().add(text);
    }

    function updateTextContent(x, y) {
        var width = Math.abs(x-origX);
        var height = Math.abs(y-origY);
        text.set({width: width, height: height})
        currentAnnotationType=text;
    }

    /*
    Arrows are initialized in a strange way. Arrows aren't provided by fabricjs so you need to create them yourself. We do this by
    computing a group of points (in calculateArrowPoints()) and then creating a polygon that encloses all of those points (so we're
    really drawing a polygon, not an arrow). Taken from https://jsfiddle.net/6e17oxc3/
    */

    function drawArrow(x, y) {
        var headlen = 100;  // arrow head size
        arrow = new fabric.Polyline(calculateArrowPoints(origX,origY,x,y,headlen), {
            fill: 'white',
            stroke: 'black',
            opacity: 1,
            strokeWidth: 2,
            originX: 'left',
            originY: 'top',
            selectable: true,
            type: 'arrow'
        });
        currentAnnotationType = arrow;
        overlay.fabricCanvas().add(arrow);
    }

    function updateArrow(x, y) {
        var headlen = 100; //arrow head size
        overlay.fabricCanvas().remove(arrow)
        var angle = Math.atan2(y - origY, x - origX);

        // bring the line end back some to account for arrow head.
        x = x - (headlen) * Math.cos(angle);
        y = y - (headlen) * Math.sin(angle);

        // calculate the points.
        var pointsArray = calculateArrowPoints(x, y, headlen);
        arrow = new fabric.Polyline(pointsArray, {
            fill: 'white',
            stroke: 'black',
            opacity: 1,
            strokeWidth: 2,
            originX: 'left',
            originY: 'top',
            selectable: true,
            type: 'arrow'
        });
        currentAnnotationType=arrow;
        overlay.fabricCanvas().add(arrow);
        overlay.fabricCanvas().renderAll();
    }

    function calculateArrowPoints(x, y, headlen) {
        var angle = Math.atan2(y - origY, x - origX);
        var headlen = 100;  // arrow head size
        // bring the line end back some to account for arrow head.
        x = x - (headlen) * Math.cos(angle);
        y = y - (headlen) * Math.sin(angle);

        var points = [
		{
			x: origX,  // start point
			y: origY
		}, {
			x: origX - (headlen / 4) * Math.cos(angle - Math.PI / 2),
			y: origY - (headlen / 4) * Math.sin(angle - Math.PI / 2)
		},{
			x: x - (headlen / 4) * Math.cos(angle - Math.PI / 2),
			y: y - (headlen / 4) * Math.sin(angle - Math.PI / 2)
		}, {
			x: x - (headlen) * Math.cos(angle - Math.PI / 2),
			y: y - (headlen) * Math.sin(angle - Math.PI / 2)
		},{
			x: x + (headlen) * Math.cos(angle),  // tip
			y: y + (headlen) * Math.sin(angle)
		}, {
			x: x - (headlen) * Math.cos(angle + Math.PI / 2),
			y: y - (headlen) * Math.sin(angle + Math.PI / 2)
		}, {
			x: x - (headlen / 4) * Math.cos(angle + Math.PI / 2),
			y: y - (headlen / 4) * Math.sin(angle + Math.PI / 2)
		}, {
			x: origX - (headlen / 4) * Math.cos(angle + Math.PI / 2),
			y: origY - (headlen / 4) * Math.sin(angle + Math.PI / 2)
		},{
			x: origX,
			y: origY
		}
	];
        return points;
    }

    //fabricJS mouse-down event listener
    overlay.fabricCanvas().observe('mouse:down', function(o){
         // console.log("EVENT TRIGERRED: fabricjs-mouse:down");
         console.log("mouse mode is " + getMouseMode());
         if(getMouseMode()=="addAnnotation") {
             isDown = true;
             var pointer = overlay.fabricCanvas().getPointer(o.e);
             origX = pointer.x;
             origY = pointer.y;

             switch(annotationType) {
                 case "arrow":
                     drawArrow(pointer.x, pointer.y); //TODO: change this to agree with naming scheme
                     break;
                 case "rectangle":
                     initializeRectangle(pointer.x, pointer.y);
                     break;
                 case "ellipse":
                     initializeEllipse(pointer.x, pointer.y);
                     break;
                 case "text":
                     // initializeText(pointer.x, pointer.y);
                     initializeTextboxPreview(pointer.x, pointer.y);
                     break;
                 default:
                    console.log("welp, that shouldn't have happened. Undefined annotationType");
                    throw new Error("Tried to switch to an undefined annotationType");
             }
             // other shapes we might want later
             // initializeCircle(pointer.x, pointer.y);
             // initializeLine(pointer.x, pointer.y);
         }
    });

    //fabricJS mouse-move event listener
    overlay.fabricCanvas().observe('mouse:move', function(o){
         if (!isDown) return;
         var pointer = overlay.fabricCanvas().getPointer(o.e);

         switch(annotationType) {
             case "arrow":
                 updateArrow(pointer.x, pointer.y); //TODO: change this to agree with naming scheme
                 break;
             case "rectangle":
                 updateRectangleWidth(pointer.x, pointer.y);
                 break;
             case "ellipse":
                 updateEllipse(pointer.x, pointer.y);
                 break;
             case "text":
                 // updateTextContent(pointer.x, pointer.y);
                 updateTextboxPreview(pointer.x, pointer.y);
                 break;
             default:
                console.log("welp, that shouldn't have happened. Undefined annotationType");
                throw new Error("Tried to switch to an undefined annotationType");
         }
         // updateCircleRadius(pointer.x, pointer.y, origX, origY); //do I need to pass this or can I access it as a member? in general, need to clarify b/w member obj.
         // updateLineEndpoint(pointer.x, pointer.y);
          overlay.fabricCanvas().renderAll();
    });

    /* event listener that handles resizing the textbox based on amount of text */
    overlay.fabricCanvas().on('text:changed', function(opt) {
        var t1 = opt.target;
        if (t1.width > t1.fixedWidth) {
            t1.fontSize *= t1.fixedWidth / (t1.width + 1);
            t1.width = t1.fixedWidth;
        }
        //TODONOW call alterannotation here?
    });

    //fabricJS mouse-up event listener
    overlay.fabricCanvas().on('mouse:up', function(o){
        // console.log("EVENT TRIGERRED: fabricj-mouse:up");
        if(getMouseMode()=="addAnnotation") {
            /* TODO:
            Might have to check annotationsDict here?
            Annoying because annotations here won't have a database pk

            If they save and immediately redraw you'll get a duplicate :/
             */

            //need to draw textbox here
            var pointerOnMouseUp = overlay.fabricCanvas().getPointer(event.e);
            createNewSerialization(currentAnnotationType, pointerOnMouseUp.x, pointerOnMouseUp.y);
            setMouseMode("OSD");
            //TODO: manually set menu mousemode back to OSD mode to correspond w/ previous line.
                        //             $("input[name='cursorMode']").prop('checked, ')
                        //               var mode = $("input[name='cursorMode']:checked").val();
                        //               $('.myCheckbox').prop('checked', true);
                        // $('.myCheckbox').prop('checked', false);

        }
        isDown = false;
    });

    $("input[name='cursorMode']").change(function() {
        console.log("cursorMode change detected: " + $("input[name='cursorMode']:checked").val());
        var mode = $("input[name='cursorMode']:checked").val();
        setMouseMode(mode);
    });

    $("input[name='annotationType']").change(function(){
        // console.log("annotationType change detected: " + $("input[name='annotationShape']:checked").val());
        annotationType = $("input[name='annotationType']:checked").val();
        console.log("annotation shape changed to: " + annotationType);
    });

    overlay.fabricCanvas().on('object:modified', function() {
        updateSerialization(overlay.fabricCanvas().getActiveObject());
    });

    $("#addAnnotation").click(function() {
        setMouseMode("addAnnotation");
    });

    $('#loadAnnotation').click(function() {
       deserializeFromJSON();
    });

    $('#saveAnnotation').click(function() {
       serializeToJSON();
    });

    $('#deleteAnnotation').click(function() {
        deleteActiveAnnotation();
    });

    //sets if you can interact with objects on the fabricjs canvas
    function setFabricCanvasInteractivity(boolean) {
        overlay.fabricCanvas().forEachObject(function(object){
            object.selectable = boolean;
        });
    }

    function deselectFabricObjects() {
        overlay.fabricCanvas().deactivateAll().renderAll();
    }

    function setMouseMode(mode) {
        switch(mode) {
            case "OSD":
                console.log("mousemode: OSD");
                mouseMode="OSD";
                setFabricCanvasInteractivity(false);
                deselectFabricObjects();
                viewer.setMouseNavEnabled(true);
                break;
            case "addAnnotation":
                console.log("mousemode: addAnnotation");
                mouseMode="addAnnotation";
                setFabricCanvasInteractivity(false);
                deselectFabricObjects();
                viewer.setMouseNavEnabled(false); //if we're in addAnnotation mode, don't set isDown to true -- actually, ONLY set to true if mode is addAnnotation
                break;
            case "editAnnotation":
                console.log("mousemode: editAnnotation");
                mouseMode="editAnnotation";
                setFabricCanvasInteractivity(true);
                viewer.setMouseNavEnabled(false);
                break;
            default:
                console.log(mode);
                throw "Tried to set invalid mouse mode";
        }
    }

    function getMouseMode(){
        return mouseMode;
    }

    function duplicateObject(object) {
        var objectCopy = {
            left: object["left"],
            top: object["top"],
            stroke: object["stoke"], /* changed strokeWidth to stroke */
            strokeWidth: object["strokeWidth"],
            originX: object["originX"],
            originY: object["originY"],  /*             */
            fill: object["fill"],
            angle: object["angle"],
            type: object["type"],
            points: object["points"], /* hacky fix */
            text: object["text"],
            rx: object["rx"],
            ry: object["ry"],
            height: object["height"],
            width: object["width"],
            pk: object["pk"],
            image: object["image"]
        };
        return objectCopy;
    }

    function objectListToJsonList(list) {
        var retval = [];
        list.foreach(function(object){
           retval.push(duplicateObject(object));
        });
        return JSON.stringify(retval);
    }

    // //TODO: pretty sure I can delete this but keep around a bit longer
    // function serializeToJSON() { //TODO: need to not save duplicate entries... maybe do that on the python side... just dont save if it has a pk? needs to coordinate from alterAnnotations()
    //     throw new Error("serializeToJson is depreciated! Don't use this function");
    //     return;
    //
    //     console.log("attempting to serialize");
    //     $.ajax({
    //         type: "POST",
    //         url: '/xgds_image/saveAnnotations/', //TODO should be able to get this from url // maybe change the url/hard code it
    //         datatype: 'json',
    //         data: {
    //             mapAnnotations: JSON.stringify(overlay.fabricCanvas()), //TODO: can't just JSON.stringify, need to add our own fields
    //             // mapAnnotations: objectListToJsonList(overlay.fabricCanvas().getObjects()),
    //             image_pk: 1 // on the single image page it's app.options.modelPK, on the multi image page we have to get it from the selected item
    //         },
    //         success: function(data) {
    //              console.log("ajax return call json " + data);
    //         },
    //         error: function(a,b,c,d) {
    //             console.log(a);
    //         }
    //     });
    // }

    //TODO: should probably change the name of this function
    function deserializeFromJSON() {
        $.ajax({
            type: "POST",
            url: '/xgds_image/getAnnotations/1',
            datatype: 'json',
            success: function(data) {
                console.log(data);
                data.forEach(function(annotation) {
                    addAnnotationToCanvas(annotation);
                });
            },
            error: function(a,b,c,d) {
                console.log(a);
            }
        });
    }

    function createNewSerialization(fabricObject, x, y) {
        if(fabricObject.type=="textboxPreview") {
            text = new fabric.Textbox('MyText', {
                width: x-origX,
                top: origY,
                left: origX,
                fontSize: 100,
                textAlign: 'center'
            });
            currentAnnotationType=text;
            overlay.fabricCanvas().add(text);
            textboxPreview.remove();
            fabricObject = text;
            //create textbox
            //maybe delete textbox
            //perhaps tie the rectanglepreview box to this object
        }

        var temp = duplicateObject(fabricObject);
        console.log("add annotation dump");
        console.log(temp);
        $.ajax({
            type: "POST",
            url: '/xgds_image/addAnnotation/',
            datatype: 'json',
            data: {
                annotation: JSON.stringify(temp),
                image_pk: 1
            },
            success: function(data) {
                console.log("successfully added annotation");
                console.log(data["pk"]);
                fabricObject.set({pk: data["pk"], image: data["image_pk"]}); //TODONOW: is it image or image_pk?
            },
            error: function(e) {
                console.log("Ajax error");
                console.log(e);
            }
        });
    }

    function updateSerialization(fabricObject) {
        console.log("serializing an individual fabric object");
        console.log("fabricObject")
        console.log(fabricObject);
        var temp = duplicateObject(fabricObject);
        console.log("alter annotation dump");
        console.log(temp);

        // if(!("pk" in fabricObject)) {
        //     alert("You just made this annotation, click save to save it (maybe we should just turn autosave off for moving annotations");
        //     return;
        // }

        console.log(JSON.stringify(temp));
        $.ajax({
            type: "POST",
            url: '/xgds_image/alterAnnotation/',
            datatype: 'json',
            data: {
                //annotation: Json.stringify(fabricObject),
                annotation: JSON.stringify(temp),
                image_pk: 1
            },
            success: function(data) {

            },
            error: function(a) {
                console.log("Ajax error");
                console.log(a)
            }
        });
    }

    function getAnnotationColors() {
        $.ajax({
            type: "POST",
            url: '/xgds_image/getAnnotationColors/',
            datatype: 'json',
            success: function(data) {
                console.log(data);
            },
            error: function(a) {
                console.log("Ajax error");
                console.log(a)
            }
        });
    }

    /* TODO: I think delete annotationsDict[annotation["pk]] should delete the key from the dictionary
    so we can use (pk in annotationsDict) later. But it might just set the value to undefined? idk gotta test
     */
    function deleteActiveAnnotation() {
        var annotation = overlay.fabricCanvas().getActiveObject();
        if (annotation["pk"] in annotationsDict) {
            //TODO: remove from database
            $.ajax({
                type:"POST",
                url: '/xgds_image/deleteAnnotation/',
                datatype:"json",
                data: {
                  pk: annotation["pk"]
                },
                success: function(data) {
                    console.log(data);
                },
                error: function(a) {
                    console.log("Ajax error");
                    console.log(a)
                    throw new Error("Unable to delete the annotation's entry from the database");
                }
            });

            //delete from dict and database
            delete annotationsDict[annotation["pk"]];
            overlay.fabricCanvas().getActiveObject().remove();
        }else{
            //annotation not saved in database anyways, just remove from canvas
            overlay.fabricCanvas.getActiveObject().remove();
        }
    }

    /*
        Given an annotation model, add it to the canvas
     */
    function addAnnotationToCanvas(annotationJson) {
        if(annotationJson["pk"] in annotationsDict) {
            console.log("Annotation is already drawn on canvas, aborting load for this annotation");
            return;
        }else{ //otherwise, add annotation to annotationsDict and draw it by calling one of the addShapeToCanvas() functions below
            annotationsDict[annotationJson["pk"]] = annotationJson;
        }
        //TODONOW: if an object has just been created it has no pk in its json js side.
        if(annotationJson["annotationType"]=="Rectangle") {
            addRectToCanvas(annotationJson);
        } else if(annotationJson["annotationType"]=="Ellipse") {
            addEllipseToCanvas(annotationJson);
        } else if(annotationJson["annotationType"]=="Arrow") {
            addArrowToCanvas(annotationJson);
        } else if(annotationJson["annotationType"]=="Text") {
            addTextToCanvas(annotationJson);
        }else{
            throw new Error("Tried to load an undefined shape to canvas (can only load rectangles, ellipses, arrows, lines");
        }
    }

    function addRectToCanvas(annotationJson) {
        console.log("Attempting to draw saved rectangle to canvas");
        var rect = new fabric.Rect({
            left: annotationJson["left"],
            top: annotationJson["top"],
            stroke: annotationJson["stokeWidth"],
            originX: annotationJson["originX"],
            originY: annotationJson["originY"],
            fill: "blue", //TODO: color dictionary reference isn't working, had to hard code it.
            angle: annotationJson["angle"],
            width: annotationJson["width"],
            height: annotationJson["height"],
            type: 'rect',
            pk: annotationJson["pk"],
            image: annotationJson["image"]
        });
        overlay.fabricCanvas().add(rect);
        overlay.fabricCanvas().renderAll();
    }

    function addEllipseToCanvas(annotationJson) {
        console.log("Attempting to draw saved ellipse to canvas");
        ellipse = new fabric.Ellipse({
            left: annotationJson["left"],
            top: annotationJson["top"],
            stroke: annotationJson["stokeWidth"],
            originX: annotationJson["originX"],
            originY: annotationJson["originY"],
            fill: annotationJson["fill"],
            angle: annotationJson["angle"],
            rx: annotationJson["radiusX"],
            ry: annotationJson["radiusY"],
            type: 'ellipse',
            pk: annotationJson["pk"],
            image: annotationJson["image"]
        });
        console.log("what does this pointer look like: " + annotationJson["fill"]);
        overlay.fabricCanvas().add(ellipse);
        overlay.fabricCanvas().renderAll();
    }

    function addArrowToCanvas(annotationJson) {
        arrow = new fabric.Polyline(JSON.parse(annotationJson["points"]), {
            left: annotationJson["left"],
            top: annotationJson["top"],
            stroke: annotationJson["stokeWidth"],
            originX: annotationJson["originX"],
            originY: annotationJson["originY"],
            fill: annotationJson["fill"],
            angle: annotationJson["angle"],
            type: 'arrow',
            pk: annotationJson["pk"],
            image: annotationJson["image"]
        });
        console.log("image and pk pls");
        overlay.fabricCanvas().add(arrow);
        overlay.fabricCanvas().renderAll();
    }

    function addTextToCanvas(annotationJson) {
        console.log("Attempting to draw saved text to canvas");
        console.log("text annotation object");
        console.log(annotationJson);
        text = new fabric.Textbox("hello world", {
            left: annotationJson["left"],
            top: annotationJson["top"],
            stroke: annotationJson["stokeWidth"],
            originX: annotationJson["originX"],
            originY: annotationJson["originY"],
            fill: annotationJson["fill"], //TODO: this is a pointer, need to access database to pull this color out
            angle: annotationJson["angle"],
            // width: annotationJson["width"],
            height: annotationJson["height"],
            text: annotationJson["content"], //text should be the right field here //todonow: this may be the wrong thing to call it.
            type: 'text', //TODO todonow todowill what have we got here
            pk: annotationJson["pk"],
            image: annotationJson["image"],
            textAlign: 'center',
            fontSize: 100 //Font size is static for now
        });
        console.log("textbox width (this is causing the error: " + annotationJson["width"]);
        //yup, we got some redundant parametesr here son.
        //IT'S SETTING THE WIDTH FROM THE DATABASE THAT BREAKS THE TEXTBOXES
        //the width is undef. textbox no field width.


        console.log("IT's GETTIN HERE BOI");
        overlay.fabricCanvas().add(text);
        overlay.fabricCanvas().renderAll();
    }

    //create a new circle and add it to canvas
    //TODO: still need to add standardized attribute/json list
    function addCircleToCanvas(x, y) {
        // var circle = new fabric.Circle({
        //     left: x,
        //     top: y,
        //     radius: 225,
        //     strokeWidth: 1,
        //     stroke: 'black',
        //     fill: 'white',
        //     selectable: true,
        //     originX: 'center', originY: 'center'
        // });
        // overlay.fabricCanvas().add(circle);
        // overlay.fabricCanvas().renderAll();
    }

/*
edit/delete: mouse modes for manipulating annotations
pk: store pk's in a pk-json dictionary to prevent duplicate loads and to manipulate from annotations list
 */

/* TODO:
mouse modes
serialization
color pallete
xgds ref
*/

/*
TODO: text content doesn't change on creation
TODO: select text after adding it to canvas, stay in edit mode


aw shit. 2 problems
1.) database text content isn't making it back out to the js side correctly
2.) modifications to text aren't make it back
TODO: still have the problem of text ot being sent correctly to the back.




TODO: add blank lines to text to make rectangle the right size

TODO: Navigate Image/Edit Annotations kinda glitchy -- maybe make a "set mode" function that will take care of the gui as well as the mode.

TODO: add printlns to views and the js file. console prints correct annotation[text] content. but views only gets "MyText" :/
the js side appears to be good...

TODO: make sure textbox content is being updated correctly in annotationJson passed thru
TODO: store text in django database (text->content transition might be iffy)
TODO: de-hardcode image_pk

TODO: select textbox editable after added to canvas
TODO: change checked to reflect state of mousemode

TODO: check if text content is saved/loaded from database. make textbox scale

TODO: make sure delete works (now everything should have a pk).
TODO: color picker
TODO: all annotations on/off
TODO: export canvas as picture
TODO: load colors
TODO: delete annotation
TODO: colors dictionary
TODO: should I be storing a list of objects on the js side so that show/hide annotations works quickly?



TODO: wacko rectangle drawing behavior
TODO: add try catch to views.py
TODO: clean up JSONresponse vs HTTP response






TODO: LATER
TODO: something wacko is happenign with stroke color in models
TODO: release as an open source plugin
TODO: rect vs rectangle (ugh fabricjs uses rect)
TODO: namespace/organize all of this to be opensourceable

TODO: monitor
TODO: prototyping/javascript namespace


 */




















