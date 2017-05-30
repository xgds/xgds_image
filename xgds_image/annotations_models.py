from django.db import models

class annotations(models.Model):
    color = #point to some dictionary?
    left = models.IntegerField(db_index=True)
    top = models.IntegerField(db_index=True)
    fill = #point to some dictionary?
    stroke = models.PositiveIntegerField()
    strokeWidth = models.PositiveIntegerField()
    selectable = models.BooleanField(default=True)
    angle = models.IntegerField(db_index=True) #store shape rotation angle

    #Might need?
    author = models.ForeignKey(User)
    creation_time = models.DateTimeField(blank=True, default=timezone.now, editable=False, db_index=True)
    deleted = models.BooleanField(default=False)
    uploadAndSaveTime = models.FloatField(null=True, blank=True)

    # Probably don't need
    track_position = 'set this to DEFAULT_TRACK_POSITION_FIELD() or similar in derived classes'
    exif_position = 'set this to DEFAULT_EXIF_POSITION_FIELD() or similar in derived classes'
    user_position = 'set this to DEFAULT_USER_POSITION_FIELD() or similar in derived classes'
    modification_time = models.DateTimeField(blank=True, default=timezone.now, editable=False, db_index=True)
    acquisition_time = models.DateTimeField(editable=False, default=timezone.now, db_index=True)
    acquisition_timezone = models.CharField(null=True, blank=False, max_length=128, default=settings.TIME_ZONE,
                                            db_index=True)
    def getColor(self):
        if self.color:
            return self.color
        return None

    def getLeft(self):
        if self.left:
            return self.left
        return None

    def getTop(self):
        if self.top:
            return self.top
        return None

    def getAuthor(self):
        if self.author:
            return self.author
        return None

    def isSelectable(self):
        if self.selectable:
            return self.selectable
        return None


class textAnnotations(annotations):
    text = models.TextField(default='', blank=True, null=True, db_index=True)
    isBold = models.BooleanField(default=False)
    isItatlics = models.BooleanField(default=False)



class ellipseAnnotations(annotations):

    # ellipse = new
    # fabric.Ellipse({
    #     left: origX,
    #     top: origY,
    #     originX: 'left',
    #     originY: 'top',
    #     rx: pointer.x - origX,
    #     ry: pointer.y - origY,
    #     angle: 0,
    #     fill: '',
    #     stroke: 'red',
    #     strokeWidth: 3,
    # });

class rectangleAnnotations(annotations):
    width = models.PositiveIntegerField();
    height = models.PositiveIntegerField();

    def getWidth(self):
        if self.width:
            return width
        return None

    def getHeight(self):
        if self.height:
            return height
        return None

