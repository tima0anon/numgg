from pathlib import Path
p=Path('android/app/src/main/java/com/chessoverlay/mobile/OverlayService.java')
s=p.read_text()
def change(old,new):
 global s
 assert old in s, 'Missing fragment: '+old[:110]
 s=s.replace(old,new,1)
change('private enum Snapshot {TRAIN, SCAN}', 'private enum Snapshot {TRAIN, SCAN, FIND}')
change('    private volatile long readyAt;', '    private Bitmap stagedFrame;')
change('setStatus("Готово: сначала «Углы доски», потом «Обучить»");', 'setStatus("Нажми «Найти доску», затем «Обучить».");')
start=s.index('    private void processFrame(ImageReader source){')
end=s.index('    private Bitmap asBitmap(Image image){', start)
s=s[:start]+'''    /** Save fresh frames while the floating window is hidden, then use the latest. */
    private void processFrame(ImageReader source){
        Image image=null;
        try {
            image=source.acquireLatestImage();
            if(image==null || pending==null) return;
            Bitmap frame=asBitmap(image);
            if(stagedFrame!=null) stagedFrame.recycle();
            stagedFrame=frame;
        } catch(Exception e){ Log.w(TAG,"Frame unavailable",e); }
        finally {if(image!=null) image.close();}
    }

    private void completeCapture(Snapshot request,long start){
        if(pending!=request) return;
        if(stagedFrame==null){
            if(SystemClock.uptimeMillis()-start<4600){
                worker.postDelayed(()->completeCapture(request,start),180);
            } else {
                pending=null;
                main.post(()->{
                    restoreOverlay();
                    setStatus("Нет кадра. Перезапусти захват и выбери ВЕСЬ экран, не одно приложение.");
                });
            }
            return;
        }
        Bitmap screenshot=stagedFrame;
        stagedFrame=null;
        pending=null;
        processing.set(true);
        main.post(this::restoreOverlay);
        try {
            Rect bounds=boardRect==null?null:new Rect(boardRect);
            if(request==Snapshot.FIND || bounds==null){
                bounds=BoardLocator.find(screenshot);
                persistBounds(bounds,false);
                Rect found=new Rect(bounds);
                main.post(()->{
                    if(arrowView!=null) arrowView.update(found,null,null,flipped);
                    setStatus("Доска найдена автоматически. Открой начальную позицию и нажми «Обучить».");
                });
                if(request==Snapshot.FIND) return;
            } else if(prefs.getBoolean("centerTap",false)) {
                try {
                    bounds=BoardLocator.refine(screenshot,bounds);
                    persistBounds(bounds,false);
                } catch(Exception ignored){ /* keep centre-tap estimate */ }
            }
            if(request==Snapshot.TRAIN){
                recognizer.train(screenshot,bounds,flipped);
                main.post(()->setStatus("Обучено. Теперь открой партию и нажми «Анализ»."));
            } else {
                String placement=recognizer.recognize(screenshot,bounds,flipped);
                main.post(()->analyzePlacement(placement));
            }
        } catch(Exception e){
            Log.w(TAG,"Capture/recognition failed",e);
            main.post(()->setStatus("Ошибка: "+e.getMessage()));
        } finally {
            screenshot.recycle();
            processing.set(false);
        }
    }

    private void restoreOverlay(){
        if(panel!=null) panel.setVisibility(View.VISIBLE);
        if(arrowView!=null) arrowView.setVisibility(View.VISIBLE);
    }

    private void persistBounds(Rect rect, boolean manual){
        boardRect=new Rect(rect);
        prefs.edit().putInt("left",rect.left).putInt("top",rect.top)
            .putInt("right",rect.right).putInt("bottom",rect.bottom)
            .putBoolean("centerTap",manual).apply();
    }

'''+s[end:]
start=s.index('    private void capture(Snapshot request){')
end=s.index('    private void analyzePlacement(String placement){',start)
s=s[:start]+'''    private void capture(Snapshot request){
        if(projection==null || reader==null){setStatus("Сначала разреши захват экрана в приложении");return;}
        if(pending!=null || processing.get()) return;
        pending=request;
        if(arrowView!=null) arrowView.setVisibility(View.INVISIBLE);
        if(panel!=null) panel.setVisibility(View.INVISIBLE);
        long start=SystemClock.uptimeMillis();
        // A stationary chess board may emit just one new frame when the overlay hides.
        // Keep that frame instead of discarding it during a fixed 300-ms delay.
        worker.postDelayed(()->completeCapture(request,start),650);
    }

'''+s[end:]
change('status.setText("Нужна разметка доски")','status.setText("Нажми «Найти доску»")')
change('panel.addView(button("Углы доски",this::startCalibration));',
'''panel.addView(button("Найти доску автоматически",()->capture(Snapshot.FIND)));
        panel.addView(button("Центр доски (резерв)",this::startCalibration));''')
change('Button b=(Button)panel.getChildAt(5);', 'Button b=(Button)panel.getChildAt(6);')
change('((Button)panel.getChildAt(6)).setText(now?"Очередь: белые":"Очередь: чёрные");','((Button)panel.getChildAt(7)).setText(now?"Очередь: белые":"Очередь: чёрные");')
change('((Button)panel.getChildAt(6)).setText(prefs.getBoolean("whiteTurn",true)?"Очередь: белые":"Очередь: чёрные");','((Button)panel.getChildAt(7)).setText(prefs.getBoolean("whiteTurn",true)?"Очередь: белые":"Очередь: чёрные");')
change('''            boardRect=fixed;
            prefs.edit().putInt("left",fixed.left).putInt("top",fixed.top).putInt("right",fixed.right).putInt("bottom",fixed.bottom).apply();''',
'''            persistBounds(fixed,true);''')
change('setStatus("Границы сохранены. Вернись на стартовую позицию и нажми «Обучить». ");',
       'setStatus("Центр выбран. Границы уточнятся при следующем снимке.");')
change('if(reader!=null){reader.setOnImageAvailableListener(null,null);reader.close();reader=null;}\n        if(display!=null){display.release();display=null;}',
'''if(reader!=null){reader.setOnImageAvailableListener(null,null);reader.close();reader=null;}
        if(stagedFrame!=null){stagedFrame.recycle();stagedFrame=null;}
        if(display!=null){display.release();display=null;}''')
p.write_text(s)
act=Path('android/app/src/main/java/com/chessoverlay/mobile/MainActivity.java')
act.write_text(act.read_text().replace(
 '4. Укажи два угла доски, затем обучи распознаватель на НАЧАЛЬНОЙ позиции.',
 '4. Найди доску автоматически (или нажми в центр), затем обучи распознаватель на НАЧАЛЬНОЙ позиции.'
))
gradle=Path('android/app/build.gradle')
gradle.write_text(gradle.read_text().replace("versionCode 1","versionCode 2").replace("versionName '0.1'","versionName '0.2'"))
print('Capture patch applied successfully')
