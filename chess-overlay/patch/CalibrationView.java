package com.chessoverlay.mobile;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Rect;
import android.view.MotionEvent;
import android.view.View;

/** Single tap anywhere near the board centre; no need to reach the screen edges. */
public final class CalibrationView extends View {
    public interface OnComplete { void onComplete(Rect result); }
    private final Paint paint = new Paint(3);
    private final OnComplete listener;
    public CalibrationView(Context context,OnComplete listener){super(context);this.listener=listener;}
    @Override protected void onDraw(Canvas canvas){
        super.onDraw(canvas);
        canvas.drawColor(0x44000000);
        paint.setColor(0xffc8f89c);paint.setTextSize(38);paint.setStyle(Paint.Style.FILL);
        canvas.drawText("Нажми в ЦЕНТР доски",20,95,paint);
        paint.setTextSize(25);
        canvas.drawText("Точные углы не нужны",20,134,paint);
    }
    @Override public boolean onTouchEvent(MotionEvent e){
        if(e.getActionMasked()!=MotionEvent.ACTION_UP) return true;
        android.graphics.Point screen=new android.graphics.Point();
        ((android.view.WindowManager)getContext().getSystemService(Context.WINDOW_SERVICE))
            .getDefaultDisplay().getRealSize(screen);
        int side=Math.min(screen.x,screen.y);
        int left=(screen.x-side)/2;
        int top=Math.round(e.getRawY()-side/2f);
        top=Math.max(0,Math.min(screen.y-side,top));
        listener.onComplete(new Rect(left,top,left+side,top+side));
        return true;
    }
}
