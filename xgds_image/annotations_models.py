DEFAULT_SINGLE_IMAGE_FIELD = lambda: models.ForeignKey(settings.XGDS_IMAGE_SINGLE_IMAGE_MODEL, related_name="image")


class AnnotationColor(models.Model):
    name = models.CharField(max_length=16, db_index=True)
    hex = models.CharField(max_length=16)


class AbstractAnnotation(models.Model):
    left = models.IntegerField(null=False, blank=False)
    top = models.IntegerField(null=False, blank=False)
    strokeColor = models.ForeignKey(AnnotationColor)   #point to some dictionary?
    strokeWidth = models.PositiveIntegerField()
    angle = models.FloatField(default=0) #store shape rotation angle

    author = models.ForeignKey(User)
    creation_time = models.DateTimeField(blank=True, default=timezone.now, editable=False, db_index=True)
    image = models.ForeignKey(settings.XGDS_IMAGE_SINGLE_IMAGE_MODEL, related_name='%(app_label)s_%(class)s_image')  # DEFAULT_SINGLE_IMAGE_FIELD # 'set this to DEFAULT_SINGLE_IMAGE_FIELD or similar in derived classes'

    class Meta:
        abstract = True


class TextAnnotation(AbstractAnnotation):
    text = models.CharField(max_length=512, default='')
    isBold = models.BooleanField(default=False)
    isItalics = models.BooleanField(default=False)


class EllipseAnnotation(AbstractAnnotation):
    radiusX = models.IntegerField(db_index=True)
    radiusY = models.IntegerField(db_index=True)


class RectangleAnnotation(AbstractAnnotation):
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()


#TODO: add line class (arrow?) or both

