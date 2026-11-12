package com.chessoverlay.mobile;

import android.graphics.Bitmap;
import android.graphics.Color;
import android.graphics.Rect;

/** Finds a full-width Chess.com board by the nine equally spaced horizontal grid edges. */
public final class BoardLocator {
    private BoardLocator() {}

    public static Rect find(Bitmap image) { return locate(image, -1, -1); }

    /** Tightens a roughly centered manual selection; fails gracefully if the pattern is absent. */
    public static Rect refine(Bitmap image, Rect approximate) {
        if (approximate == null) return find(image);
        return locate(image, approximate.top, Math.max(64, image.getWidth() / 5));
    }

    private static Rect locate(Bitmap image, int suggestedTop, int radius) {
        int width=image.getWidth(), height=image.getHeight();
        if (width < 160 || height < width)
            throw new IllegalStateException("Автопоиск доступен для вертикальной квадратной доски");
        int maxTop=height-width;
        int minY=(suggestedTop>=0)?Math.max(0,suggestedTop-radius):0;
        int maxY=(suggestedTop>=0)?Math.min(maxTop,suggestedTop+radius):maxTop;

        int[] xs=new int[14];
        for (int i=0;i<xs.length;i++)
            xs[i]=Math.min(width-1, Math.round(width*(.02f + .25f*i/(xs.length-1))));
        float[] edge=new float[height];
        for(int y=1;y<height;y++) {
            float sum=0f;
            for(int x:xs) {
                int a=image.getPixel(x,y), b=image.getPixel(x,y-1);
                sum+=(Math.abs(Color.red(a)-Color.red(b))
                     +Math.abs(Color.green(a)-Color.green(b))
                     +Math.abs(Color.blue(a)-Color.blue(b)))/3f;
            }
            edge[y]=sum/xs.length;
        }

        float best=-1;
        int bestY=-1;
        for(int top=minY;top<=maxY;top++) {
            float sum=0;
            for(int row=0;row<=8;row++) {
                int boundary=Math.round(top + row*width/8f);
                float local=0;
                for(int delta=-2;delta<=2;delta++) {
                    int y=boundary+delta;
                    if(y>=1 && y<height) local=Math.max(local,edge[y]);
                }
                sum+=local*((row==0||row==8)?1.2f:1f);
            }
            if(sum>best) {best=sum;bestY=top;}
        }
        if(bestY<0 || best<125)
            throw new IllegalStateException("Не получилось найти сетку. Нажми «Центр доски».");
        return new Rect(0,bestY,width,bestY+width);
    }
}
