import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useTranslation } from "@/i18n";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageGalleryProps {
  images: string[];
  alt: string;
}

const ImageGallery = ({ images, alt }: ImageGalleryProps) => {
  const { t } = useTranslation();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const openImage = (index: number) => setSelectedIndex(index);
  const closeImage = () => setSelectedIndex(null);
  
  const goToPrevious = () => {
    if (selectedIndex !== null && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  };
  
  const goToNext = () => {
    if (selectedIndex !== null && selectedIndex < images.length - 1) {
      setSelectedIndex(selectedIndex + 1);
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {images.map((src, i) => (
          <button
            key={i}
            onClick={() => openImage(i)}
            className="aspect-video overflow-hidden rounded-sm border border-border hover:border-gold transition-colors cursor-pointer group"
          >
            <img 
              src={src} 
              alt={`${alt} ${i + 1}`} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" 
            />
          </button>
        ))}
      </div>
      
      <p className="text-xs text-muted-foreground mt-1">
        {t('quests.clickToEnlarge')}
      </p>

      <Dialog open={selectedIndex !== null} onOpenChange={closeImage}>
        <DialogContent className="max-w-4xl p-2 bg-background/95 backdrop-blur">
          {selectedIndex !== null && (
            <div className="relative">
              <img 
                src={images[selectedIndex]} 
                alt={`${alt} ${selectedIndex + 1}`} 
                className="w-full h-auto max-h-[80vh] object-contain rounded" 
              />
              
              {/* Navigation buttons */}
              <div className="absolute inset-y-0 left-0 flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToPrevious}
                  disabled={selectedIndex === 0}
                  className="h-12 w-12 rounded-full bg-background/50 hover:bg-background/80 disabled:opacity-30"
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
              </div>
              
              <div className="absolute inset-y-0 right-0 flex items-center">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={goToNext}
                  disabled={selectedIndex === images.length - 1}
                  className="h-12 w-12 rounded-full bg-background/50 hover:bg-background/80 disabled:opacity-30"
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>
              
              {/* Image counter */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-background/70 px-3 py-1 rounded-full text-sm">
                {selectedIndex + 1} / {images.length}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ImageGallery;
