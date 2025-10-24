/**
 * Boot Sequence Component
 * Animated retro hacker boot sequence - NOW ACTUALLY SWITCHES TO NEXUS_ART!
 */
import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

interface Props {
  onComplete: () => void;
}

// Boot sequence ASCII with "INITIALIZING"
const BOOT_ART = [  `


                                                                                                    tf
                                                                                                  ;,   t
                                                                                                  :..,. ,
                                                                                                  .,,,,,: i                   LCt
                                                                                                  ,,:,..,: i                t.. .t
                                                                                                :,:...  ,,.               1 :...,
                                                                                                .,:,.    .; i             i ;..,:.
                                                                                                ;:,,.     . :            i :,..:;.i
                                                                                              :,,.,,..   . ..          : ,.  .,;,L
                                                                                              :.  ,,...... .:         ., ,  ..:::L
                                                                                    . .. .    :,.  ,....;;, .;.       .: ...,,,:,:f
                                                                    . ........................i . ., .;i1i    ..     :;. :::::,. .L
                                                            ........................,..,....i:  .,. :i1:   :i1t1i.,1:,,.:ft;,   ,i
                                                        .........................,;;;tf11tftt;1i::...:, .;tLfLfffttttLCCCtf;,  .:
                                                    ...........................,:i;ii11111i1tGCCt,,:.. :;:;;;;,;,:,,:itLGGC;,. .f
                                                .......................,,,,,,,tt;;;iii1ii;;fi.ii: :i::i;i1tt11i:;:,,..,;tLLf;:.,G
                                              ...................,,,,,,,,,,:0,:Ct1i;;::;;:;1C:,,  .,:;:;;11tfffffttti. ,,;1LL1tC0C.
                                          ..................,,,,,,,,,,:;t,: :;,Lft11;;:;::iff..  .:;.,:iii;ii11iiii1ft,,itffCLitf0i
                                        ................,,,,,,,,,,,,,:C,  ;,.,GGGLii;:,,,ifL1., ,::..:,;11:,:;:,  ;;1L1;1tL1fCf;:t
                                      ...............,,,,,,,,,,,,::.iii:::,,..0G0L;::,,,;ttLi.:,:,     ,iifi..     ,;1tii;C;,iLii;
                                  ..............,,,,,,,,,,,,::::,11.;;,:,iGt:C80C;:,,.,i1iti,:..       ,i.  ,f.      tft.,.  :f1:.
                                  .............,,,,,,,,,,,:::::;L:::,,:1CG0080fG8G;:;:,;11ii:,.         .  . ;f  .  .,itti ; i fif...
                              .............,,,,,,,,,,:::::::;:,..:,,:tG800808088Li::,,i11i:,,            .;,,:::;.  :;1fL;L;L ttf....
                            ............,,,,,,,,,,::::::::;;.. ;,. .:itCG0000Gt0fii:::i1i;:;,         .   .:i;;::,  ,,,t0Cf,i1tLi.....
                          ............,,,,,,,,,,:::::::;;;,,;,L;.. ,,,,:;1fftttCt;11;;ii;;;i:,:::;::,:;,.   ..:;;::tf1iiLGGCtCfL.......
                        ............,,,,,,,,,:::::::;;;;;,:, LGi.. .....,:f,,::;;;tt1;i;:;t1tttftii:;i;:..   .;iiitfLf111fG0GCG:.........
                        ..........,,,,,,,,,:::::::;;;;;i;i ,:8C,    .. .....,.:.;tL1t;:;ifLLLfftt1::ii:,... ,i;:;11tt1;;i1;ifLf1.........
                      ..........,,,,,,,,,:::::::;;;;i;.1i.  C0         .ii;:,:,.:1fft;;ifLtttfLLCt;:::,.,:ii:, .:i111t1;:,:;i;:i,.........
                      ..........,,,,,,,,::::::;;;;;;: .:Lt.. 8  .,.,..:1G: 1:,::..i11ti:iLt;:::;;;i:,,.  .,,,,    .,,:;:,,:tC08CtL,.........
                    ..........,,,,,,,::::::;;;;;;,. ,,LG;.  L ;,.,;:;f08C8;:.....,iii::1ti:,,,,::,,...             .,,.  ,,:tffiiG,.........
                  ..........,,,,,,,,::::::;;;;;;   . .0G;.. 1;:10,,tG00880C..    .,ii::;i:............            ..,, .          G,........
                  ..........,,,,,,,,:::::;;;;;i,     ..80;. ,,.t.fC;iG0000t;; .    ,i;,.,:,..   .. .             ..::..,        .  .,.........
                  .........,,,,,,,,:::::;;;;ii..      .88i,.,1fL.:;.:;1tf1:,.. .  .:::,....                      .,:,,,,.      ..1,,,,........
                .........,,,,,,,,:::::;;;1:i.ti,  .  .08i;t.  , .  . ,;i;,,.     .:,:,.                   .  .    .. ,,.       ;G,,,,.........
                .........,,,,,,,,::::;;;iL;fC;08Cii .. fGt:L.         .:,:,.       .....                 ,    . ,  ..,,.       ;8i,,,,..........
              ...........,,,,,,,:::::;;ii.;iC:G8Ci.  . ,11:.0..       . ..           ...            ...  ,     .,,,,.,. .     ,8:;:,,,.........
              ..........,,,,,,,:::::;;;ff:;:,,.t;.     .,::fti,...   ,     .                      ....... ,          .,:,,,...fi;:,,,,..........
              .........,,,,,,,:::::;;;:CG:.   :,.      ..,C,.,.       ....        ..           ....,,,...         :CGtL0Li;;::::,,,,,,..........
              ........,,,,,,,,:::::;;f C1,   ,,,.      ..C,.:,   ..;;,,,...                     ...,,,...        ;1f1tGGi;;::::,,,,,,,..........
            .........,,,,,,,:::::;iL;  , ,::..:.       G:,.,. .:,.           . .                ...,....       .,i11CGfi;:::::,,,,,,............
            .........,,,,,,,::::;;01,i i ... ,i,      ft..,. .:..                                .........    ..;tLCG1;;;::::,,,,,,,,..........
            .........,,,,,,,,::::;CG;.. ,   .,;:      ;C..:. .,..  .               .               ..,:;,     ..:1CGfi;;;:::::,,,,,,,...........
            .........,,,,,,,::::;;8f,.  ..  ,,;       0,.:...,,   ,.            .  .          ....   ....,;:;1fLLt1ii;;;;::::,,,,,,,,...........
            .........,,,,,,,::::;f0;.   .  .,;.      . :  ..,, ,...               .           ........,,::;itfCGfiii;;;::::::,,,,,,,...........
            .........,,,,,,,::::;81,   .   ,::         11    .; ..1,       ,              .   ..,,,,::iiii1tfLt;iii;;;;:::::,,,,,,,,............
            .........,,,,,,,::::;8.    . ..:;..       f1 .i.    ..,t:...  ,..      ,...     .. ..,,:;1ttLL;, ,:ii;;;;::::::,,,,,,,,.............
            .........,,,,,,,::::;L : .   .:,,..    ...;:  ...:L;t;.,1;..,  ..   ...,,,,,,.. .....:itfff1,   ,,i;;;;;:::::,,,,,,,,,.............
            .........,,,,,,,::::iC.G.    .,  .    ;::,L i.    ...;1L0C;,,C;,.  . ...,,,,......,:;itLL;.... ..i;;;;;:::::,,,,,,,,,.............
            ..........,,,,,,,:::::Gi , i     .   ii1tttf   ,L,;...:tGG0f;L0t:.  f    ...       .;tt;.,,.. ,,i;;;;::::::,,,,,,,,,..............
            .........,,,,,,,:::::0.            i;it1fCCL1;G  .1 ,.:f0G1.it0i;. .              : :       0ii;;;;::::::,,,,,,,,,...............
            .........,,,,,,,:::::,.,   .      ,::;1fCGCfff, ..:    .;G0;:;t0G;. f          :t; .   .i.G,Gf;;;;::::::,,,,,,,,,..............
              .........,,,,,,,:::L;    . .. . ,,:;1fCGCffff:.         ,f0f.:L00;. fLftttffftttt: .  .L,. i8;;;:::::,,,,,,,,,,..............
              .........,,,,,,,,:1..,..,  . ,.,,::1fCLtttffff;.     .   ,  1 ;fG0:. tfffftttttt11. ., 1;.tiCi;:::::,,,,,,,,,...............
              ..........,,,,,,,t:f,i..,::,,,,,:itLLttttttttffftt:   ..  :,i. .t10; .ttttttt11111..:.,.L.,0:L:::::,,,,,,,,................
              ..........,,,,,L:f.:.:,,,,,,:;1tft11111tttttttttf.:.    .   ,   if0; ,ttt111111iii  :,.;;.ii8::::,,,,,,,,...............
                .........,,G.L:. . ,..,,,:;iiiiiii11111111ttttt:1t; .       t;Li,C01..111111iiii;;  ,:.t,:;G;::,,,,,,,................
                .........f.:.   , i:::::;;;;;iiiiii11111111f i1G,,..    :   ft0f.G01.,1iiiiii;;;;;  .:.;,L;8:,,,,,,,...............
                  ........G    .:, ::::::;;;;;;;iiiiiiii111i;iL,1. .:,   .i   tt0LtG0f..iii;;;;;;;::  .,:;: ;1,,,,,................
                    .....i        ;,,:::::::;;;;;;;;iiiiii:L.C1.,, .Lii   .;   f1L,1L0...t;;;;;::::::  ..;tt10,,,,..............
                    ...... ; .1  ,,,,,::::::::;;;;;;;;;;;:;,    .:.,;;;;...,   t1,:1LGf:.1:::::::::,, , .1iC10................
                      ...it. f1,,,,,,,,,::::::::::;;;;;;;t, .   .C.;;;;;;.,,.  .t,.,:t0G:.L:::::,,,,,.  ,:1; Lf............
                        ...0. 0:.,,,,,,,,,,,::::::::::::::1     . .0:::::::..,,: .i,.1 ;,   G:,,,,,,,,,.    ., C1.........
                        .t.t: 0.....,,,,,,,,,,,,,:::::::::, :,   . ,C:::::::.,,,......i,.,   t,,,,,,,,,..., ,; .G;......
                      .0t;..,L;.........,,,,,,,,,,,,,,,,,,,::,   , .L,:,,,,,. ,: ... .1    , ;,,,,......   ,:;,,0L...
                      ;0i.:.,0t.............,,,,,,,,,,,,,,,,,,,L, , .10,,,,,,,::   .. ,.:;;i ...........::  .:,.,
                      ,      i;.................,,,,,,,,,,,,,,,:  .,,i1iit1,,,.        .:;itC ..........  .   .L
                      ,;;.,;;;:........................,,,,,,,,   ,;:..  .;1L....     .,::;ifCG..........    . ,:
                      .:i. .; .1  .................................,;:..:  . :,...    ,;;:;;;;itLC...............;
                      t., . ,  :         .... .............................,,,,,,,    :;i1111ftt1tfi1fCGt,,,.:.. ,,;.......,.........................
                  ... .    .                                   ....................   .;1f:,,:.,,:1tt,ifCG;,,,.,,  ,   ..,.,i::::::::,,,,,,,,,,,,,,,,,
            .............................                                      ........i1i;,;  ,:;1f: :iLG:,,,..  ,,.,....;:iiiiiiii;;;;;;;;;;;;;;:::
            ...............,,,,,,,,,,,,,,,..........                                   ,:i1;.,  .,;:t, .:1C:::::::;;;;iiiii1111111111iiiiiiiiii;;;;;;
            ..............,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,............                ,;:: ,  . ., :  . i:;;;;;;;;;iiiiiiiiiiiiiiiiiiiiii;;;;;;;;::
                ...............,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,.........     .            :,:::::::;:::::;:;;;;;;;;;:;::::::::::::::
                      ....................,..,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,.......,,,,,,,,,,,,,,,,,,,,,,,,,,,:,,,,,,,,,,,,,,,,,,,,,,,,,
                                ...............................................................................,.,...,,,,,,,,,,.......................
                                                  .....................................................................................................

  `

];

// Running state ASCII without "INITIALIZING" - just "SAAAM NEXUS CODE"
const NEXUS_ART = [
  `
                                        .            . .                               .  . . ,. .   .   ....         .  .          .              ...          .                .
                                        .            .         .              ...  ...,.    ..,.  .......... .  . ... ....       .  .         .    .            . .             .       .
                       . ..,.          .:..          .     .  .     ... ......  .  ....... ...:.................. ........   .  ...:...       ...  .           .t.                         1.
                                       .1. ,.  ...  ..  . .  :... ...... . . .......:.:.......,....,.....,...............,... .  . .. ...    .;.. ..        .   ,     .                  . . .
             .                          ,       .  . ,. ...........1,..............,,.,......,:,:,,,,,,,,,,,,,...,,,,....,..... . ... .       ..   .    .       ,           .              .
           .                                                                    ...,,,,,,,,,:                  :,,,,,,,,...................   .    .                             .         .              .
         .   0CCCLLCLCCLLfLLLLfCLCLCCLCCLCLLLCLGCCCCCCtCLCffCCCCLCCLLCLCCGLLLttLC1:f;1;,    i:;.......; .:,...1t.    :::;ii;ifLfLfLLCCGLCLCCCLCLfLCL0CLLCCCCC0GGLfGCGGCLC           ..     .      ,
             iGL                                                              .....,   ,f,..,... ...  ;... .......,:1   ,......                                         0GC    .    ,      .      .:i:.
    .         GC  :i;::;;i:;:ii,ii;;:::;,ii11i1ii ;;i1t1;;..,1;i,it,::, :::;,:i::   i:i,.,....., ::...L,,.,. ....,.., .f   ,.,,.,.;::..: ,:,,i;1i .,.:: i: ,;i1,;;:1::;   GG               .      ..,   .
    .         0tG  ;,::iii.i;;,;::i1i;:ii1i;i111; 1:;1:it:ii:111;.i;,ii.,i,.:::  .f::;,.,......,,,..:,L,,..,.,.,...  ..  ,C  ,,i,;;;:ii;.,:,;,:i,;i;;. ,.i.11:;i:i;1;ii;;  CG        .     .  .
               Cf  ;1;;i;:ii1i11t;ii;;;i:;i.i;i1i :ii;ti1t1;,,111.,1,i;.;,i,.. .t.:.,  . ...,..i,.,,:,C;:,.:.;. ,...:.   ..:C  .,,.:ii;i:i;,;,,        1ti 11i11111iiiii. ,CG  ..       .  ,       .
               fG  ,;i;i1i tii:1;1,i,,it;;;1;1111 ;i1;1;1,;i;t111.:;;,:.,..,  L,,....,..,.,.,.;:,.,,,;L;::,.,.,,: ,..,. ..,1t.  ,:;:,1:i1;,;1i11;111t1 1i1.1t1i11i1ii11  GL         ,.. .  .
            ,  tGG   i11;11i1ii:;:i;1;i:1;;:1;11;i..      iit,i1i:iii,..,,,  t,,,.,......::;i,i;i,;i;1t;i1,,;,,.;...;.......,.C  .,,,,i;i,;1t111ii1i11 1:1:11111111i;.  GL       .  . ...  .      .
        ....    CC  ;iii1,1tii1i1ii;;i;,:1i1:it1i11tt111i,;:i,,.::;i,;.,.,  C:1 .  , ,.,;,i,,:,::i;i0G1tGii:1t;,1:,,,1....,. ;,1  ,,:,,.i:;1t111111i;1 i:;i11111ti1;  CC   .     .    .    ..              .
          .     0Cf ;1;tt1;it11i1iii111;11;11i;.:.   .,:,..,...:::,....,,: ,.: ,.,.,:.,,,,,,::;:tttGti1tiLCi1:::::,:;,,::,  . ,iG ,,,::,i11it1i;,tt1i:,...1;11111t   fL   . ............   .     ;..
  .              Lf   ,.t;11t1;:;11,i1:t;tif;  ,:G11if.,:;::,,,:::,,;;:::  ; ;..... ..,::1;:;11fiiG1fii11;Ctiiii;i:;:i,,i. i ,:;;  ..,:;,i1i:i11,,;.i1i1 1i1t11ii                       .. .
    .  .         LL  1t,::;t;,,.;;;::1tt1:, ,0tC::   .,:,;.....,..,....., .t.,1......;,:801iii11C00ft11tftC081iiii;i8ii:.,, ,; :;t ,,,.;,;,i;i:: i1;iii: ;1i1i1i1                   0CG    .   .
    ..,       .  CGG  1..:1i:t1;iit1;1tt: :Lt:. ,;;1;.::;,:;:;..,.:,..,,, t,...:.,..,:;;81i;;i1i1GttfG08fttG1ifi;;:i0i1,.,...:.; L :,,.,,;::,;;i:;,1;:ii:ii;tii,i1i:i1111 ;i.:i1;1;; fL    .  .      .
     .       . .  CL  i1:1:ti;,11t1itit; Ct,. ::i,1;1,:,;i:;i,.,,..i,.,,, G: . i.,,,:;:;iGi;it1iffC8LfLLL8Gf01ii;i1G;;:,:,,.....::  :,.;,..,,:,,i:i; iii;;11ii;i1;111ii1i 1ii:1;:1i1 LC    . .
               .  Gf  1 :1;;ii;1it1f1:1 it,  .:i;:1;,:111::,,.,..:.....,, i ...:..,,.:;,::0ti1fC0fLLLLCLLfLL0G1i1i8f;:,, i.....:,1  :,:,...t.....:.; 1i;;,i;iii,;11t:;:1: , .111:;,  CC    ..           .
               ..  C0  ;11i;1tiii;:111: 0f; :::::i;1:;.;ii,i.;,,;,,..,.., L,  .;. , .i,;;1tL80tt8ffC08880CLC8tt08ti;,,,,.....i .;, .,,,..:....::.. .   .     .     ..;,.: 11tttti;1  GL  ..,.         .   .
              . .  GG  11:i,11111i111:, 0C  :,1;ii..,:,;:,,.i,,,::;:1,.., G;, ..;.::,;:1itt8118L8CLL88000CCC8f8tt81;;;1,;...; . i. ,,,,,.....,...:..,,ii;;i;1i1:1111it;1t1;tti1;1   LL   . ,
          .        0L  1i1.1iiiiit.;t;, 8f, ii;;.,,.:.. ..,..,,f;i,,,;.,, f::,..,:..,.,;;t0t1iff0LLLCCCCCCCC0ft1110f::;,,,.i . .;C :,:,,...;,.. . ..i.::,,i;i1111t1i;11i11tttt    GL  .... .   ..
  .     .        .  GC  it;ii1;1;1iit:, Lf; i1;i,:..,......i.,...f.....,,  ,   :.i.,,1:10ii;1ttiffC0LfCC88CLf1if:;ifL,;:,;.;. :. C :::,,,:,.,........... i.,.iii,111,t11i1t11,  CC  . ,... .
   ....             LL  ti111:1i,1ii.,   L:  ;:;..;.....i.....:....,,  ::  ;,..,. .i,::18i11111ft8ffG0GGGLL01t1ti:;iGi,;.,... ,.,L  Lf  ,...t:,,0,,,.,,.. :,::i;:;.;,i;i,i1ii  Lf   ...... .  .
  .,:..    .   . .. iGf       t1:;1,1i;: ,fi ,:..,...i....i.....,,,, ,;;;1 ,..., ,.,i;:iiGG8080000f1ffttifCC808808G8i::,,.  .. .: .t;:; :, ...i::;1::.,.,.,,:;i,;i;1i1t1t11;1  Ci .. .,.. .,..       .
  ..... . ..;......  fL  1i11tti111:,.:.. if; ,.,... ..i.. ...1...,, :   ;. ;   ;.,;it1:;,:tLff;itG111i;it811:f1ii;:;i,:;1, ..  , ,;  .  ,.....;;:;1Li:...,.;::i: :;i:.11111t  Lf ....,...,,........,,..;....
            . ...... CL  1ii;1;;ii1;i.:... tL; ,.....:. .,1. ...,,,: , ,. t 1.: :itCCCGLitff;1i1tiiGt11tCGi:t,:f11LCGf; .i,, . ., i ;    ,,.,..,,:ti1;0:,,...:,;:i;11ii;;i1i  :f  ....,..,,,.     ., ,,
  .     ..  . .. ... GL  111ti1ii;i;,,,,.., .1; ,.,....f.....,:..::, ; ..   1  ., ,..,. ,.,..  :tii1;1L;f1:it, .,,,:... ,. ..   .,    .  ,..,......:1;,,,..,.,:,,;:;::i;1i  .C   .....,............ ..
       .  .   ...  . GC  ,1i;i;1ii:::......, iLi .. t.............., ; ,   ,i..  . .,         ..,.,:;:,i:;i   ,.       ,....  .,    . t ,.,..,,t.....;::,G.,.,,,,::::;;i   f   .......,....... .. ,  .
 .      .  .,.. .... GL  it. .::;:;:; ,.....,  Cf; ........:.....,,,: ,.   .i., ,            .; ... ;,::,. .. .          . ,.  , .  ,.  ,,..1:........,i:,;:.:;:,;,;i:.;  f ..........,....,....,    .. .
   ,    .   ..,...., Cf  ii1i1:;..;:, ,.....,,, ;f;  ........;...,,,,  ,,   :..:..,    .t... .  ,.  1::::   :   ...1,  1  .: ..; .  .: ,,,. ;..:.... ...1,:::::1:;;::;.   1.., ....,..:.........
     ,.   ... ..;... CC  ,iii:,1;:;.,..t. .,...,  ,t;  ,.....;.,,. :1, .,. . .,.;:,.,..:;Lti;    .. i:1.;. ..,: i1ftt,.,:,,. , i    L :,,...;............i.,;:.::,.,,.. 1.............:...........     ..
       :  .  .   .;. Ct  i111ii:,,,.,1,..:......., :Gti .,..,  ,,;,:.,, f..  L ,.:,,,;i::::;;:.f,...1.Lii..;,.   , fi1 fi,.,:  i :.; :,,,,..1.......;.....;..:,,,,.  t11..............:....1. ..: .  .
  .   . .... ....... Cf  :.;:;i,,,:;t.... , .....,,  ;tC,   ;f;; ..,,.,, ;.,,.: .,:,;i;f;i:,L:.;i. .11L:1. :,.;f1.fi,,it1.;.. t .., .,:,, .,1...... ..,,..,,..i,.., ............:.....1....t.. .;.  ..  .
. . ...   . .. ..... CC  iii,1::,it;..; .........:.,,. itG:    ,..,...,., :,: ;, ...;,;;ti.tii;i;,,.:1ffi..;,,1 :;;.i L:ii...t  ,1 ,,,.,,;,  :............... .;.  ;..........,.....:.,.,..1....;.. ..  .   .
  . .. ..:...... ... CL  iiiii .;8::.1 i.......1...,,  .:;CCi .,.,...,.,.,.   ; :, .:;,11L,;.,::,.. t:1t: ,:  ,;:;t.::,::. , :   :,...,. .;1;, ,,.....,:... ..  .. .....,....,....;...:............ ..  ...;
.    ..,............ Gf  11;...iC:,,;........:...,, :L;;   :Lf;  ,...,,...:.,  i  1.,.,,it::.;; .1t.11LL;.i:  :i.;.:;:i . , .t ,,.,..,..... ;;C; ,..,...........i............:..,...:..,..........i..  ..i.
.    ..............,.GC  t1;i;:f,,,,  ......,..:, :Li; .,,,, .;t,  ,..:....,,. i, . ,,:,:,;:... ::: ifff1 1;; ,.:,,;: .., , i: ,........, .,. ;1G: ,.,....,..........,.......,.......;,.........f... ..,.
 ... . . .:....:. ...GL  ..    ..., .  ......., ;f1i .,.....,,  ,tfi .,,...,,, L;    . ;:,.1:., :;.,,ii1., :;.;..i,.,i.  :.i;  ,..........;,.,  ;1i  ,.. .,...... .... . . .. .. ..t,.... ....f.. ...,....  .
      . ....:.....,..GC  1i::,1,.t.i.......,. :Ci; .........,,.,. :ft;  ,,,.,, ;i...   :,::,;,::.     i,   .,. ,,.,:,...  i:; ,,.,.t....,....:.,  :fi  ,.........:.................,.:Cf;,::t... ...... .   .
  ... ........i,,.,..Gf  .1i,;,,. ........,  ,i:  ,.....;.........,  :fL: .,,,, f:., ....i:;,;t:.,,, .. ,,. .:;.,;,,.... : .  ,......:........,.,, :1C, ,.................,;.......,1...........,:....  .   .
  ..   .... .....,,,.Gf  :;.:;,.;.......,, :1f: ,..... ...:.,......,,,  :i1:..,  t,:.. ,. ,;,.;,,:;1i.,,i:;i.,:,.,:: .. ..;  ,,...........i,......,  :Li ,........ ...............,..........,,,,.....  ... .
.....,..... ,......,.Gt  ::.,,.........,  Gt;  .....,......... .. .....,,. ::;:,  L: . ,,.,,.         .           ....,.1L  ,,..,1i,,..,ti:,,..,;.,,, i1: .,..............................,.,... ......:..
  . ....  .. .  ...,.Gf  i;.;. ,.... ., ,tGi ,,........1. .............,,.,,..., .  11:. ..:,..:,,,;i111t::,,,. .. . . i,  ,...........;...:......,.., :ti  ,.. .. . .. . .... f...........,.........i... . .
...    . ..........,.Gf  ;:;,..,....., :ti  .......................,....,,.,.,;:  ,   , . ,,..,.. :fffti:   .. ,, ,. if   .,,........,.......:.,..,..., ,ii .,,..........,.........,,,,,.....................
  .. .. ....  .....,.CL  11:,:,,..... :f1  ,,,...........t...;,...,:....,..,;,.,  ..   ,1,.;..... .  . .. .........;C   . ...... ;...... .:....:......., ;1: ,,,....,..,...................,...............;.
.  .  . .. . .:....,.Gf  i;,:,.,.... .fC  ,,.....,...,;i;,.... .....,,..,1.: ..,  i ..   t: ,,:,. ;:,.;:t.. :.,...i     . .,..,,,,:... ...,.... ..:t,..,, .fi ,.............,.......,,,:,...............:....
........,.,........,.Gf  ;;::.,...., tLi ,...........,::;C,........,. ,i,  ,,.,,  , ,  .   1...,;1,,f;1:ii.;., .L       ,  ,..,.,...,,.................,, ,LL  ,,,,.,,.,.;....,,,,,,,,,,.............,;......
.. ........,,,1,.,.,.Gt  :i:i.,..... LL .,,. ...  ..,. .  .. ...,. :8::  ,,...,, 1  , ,      ;:,::,,;,;:,.,.,.1      .. .  ,..........,.....::..........,  ,L; ,,,,,.:.....,.,..,................... .......
,..,,,,,,,,,,....  ,.CL  i;::;:.... .L; ,,......i,........,.,...;8;:  ,,,....,  f ,  ,.; .      1::..... :.ii    .. , : ,   ,...,.,.......... ..........,  ,fi ,,...,..,.....,C,........  ..... ........ .. .
........,.,,.........Cf  ii;::;..... 0Li ,,.............,, .if8i:  .,,,...,,  ,1:; : .,,:                       .. ..,  ...,  ,.....,...........,,....,., .1Gi ,,,,...,,....,...i,..............,,........  .
   ....i.............Cf  i:::::,:... ifC;  ,,,,,,,,.   ,;i8:,i  .,.....,.  ,f,: ,. . .i 1.,       .             .  i,, . ...,t   ........,:t,...........  :;;: ,,............,..........,..,.1........... ..
  .. t..  ..:........Ct  i;i,;,.;.:.,  :iC1:;;:;i;.:Gf::,;   ,,...,,.   ti;,..:...;... ; ; i     ..,      .  .  . ; ;  ..i . ..;t.   ,..........., ....  :;:; ,,,,.........................................
:;i: . .......,;i;;;.Lt  ;,;,:.i:;,...,   :;:::::;;     ,,,....,.   fft;,,.. .........  1 t ; ..   .. , ..    .  t.;   ........:,,,1i    ,..........., ,:i;,  ,,:::::i:;i;:.....,;iiiiiit111i1iitt.. .... .t.
     .   . .:......,.Cf  i;:,,,;::,,.,.,.,,:,:,,,,,,,..,..,,    iLf:;i,:,,.,..i ......   :,.   .  .,...,:, .    i : ... .. ..... .....iti,.  .........ii,:, ,.,..,,..........,...................... . ...
    .... ....,..,.,,.L1  :,::::,:,, .,,..........,,.,,,,    ftif,::,.,.....,.;.. ; ...  . .,    .       .  , . ,,i  .......   ..;.......,,:,.,..,,:ii0;:  .,...............:...;..........,... ....... .... .
    .    .........,..Lf  ;.:,:,;,;;..,,....,....      ;1;.,:.,.,.,..:.,.,.. ..,  .. . i.... ; ,    ...         : .. ....... .  . ........,,.,,:;itC1;:  ,.,...,...,t,.......................,..... ........
 .,................,.ff  .,;;::i,i:,.,.,.     ,11.i;i1LiLfi..,. . ............... .. , . ..... :  ... . .. .  , . .,....... .   ,......:,;;11L011:...,:;:     ,..........t............... ....:...;. .  ..:::
....... ... ... .....ft  ,:;:i,:::;;     ::,,,:.,,;,,i.,:...;.:1t.... ... ...;. ... . .. .......    ... .  ... . .  ............,,:;;i1LGL11;,.....:f,.:..;,;f.   .........1....................,...,. ..
     .   ............ff  ::::;:,..   ....,....,..,,,.,....,,...,.....,...................1f1....... ..... .     .... ..,,::i,..,;;;,,,,:........,... .....,..,:iL.  ,.........,............. .. ..: ......
   . ..  ... ... ... Lf  i.,,,;.   .i1tt1tttttttttt11  .  .:.....  ttffttfft  ....  ;:. ... ..  Lfttftftt  ....,.,,.,...,.  ttttffttf ... ....... .  tfffftf1  .,,:i  .....  1tttt1t11 .,.... ... . :..... .
 . .  . . . .. ..... tf  ;i,,.  ;00LLLLfCLLLfCLLCLLG.  .......... ;0LCLLLLLG1  . . :i...  .... .GLCLLCL08:  . . ...... ..   0CGfCCGL0f ....,,......   GLLGCG0t  ....,,  ..  1GGLCLCL8, ,  ... .    . .; .
      .. . . ...:... Lt  ,::. 10GLCfLfLLCLLLCfLffLLC    ,... .     0ffLCLCCL0; ...,. . ... .. tGCCCCtfCfG    ....... .... 1GCLLfCGLLCL. . . .  .. .   GLLLCLL0t  .....,  . t0fCCLLLC0  ... ..   .   ..  ,
   . . ..  .. ..,... Ct      iGfLLfLLLGCGGGGGG0GCCGG.  .    .    .GCfLL8LLLLG      .. .. ... .L0CCLCfCLGLG,   . . ,.. .. .0fCLfC0LfLCG   ... ..; ..   GfLffLCf01  .,.. .  10fLCLCCLf0  ...;. .   ..  ,
     .  .. .  . ,.... Cffii   CLffftG,            1       . ,.. tGfCCLfGCLLLCC,  .   ....     GtfLL0GLLfCL0t .   .... .   GfLLt0GCLCCLG1  . . :. :    GCfLfffCtG1  . . . 10CfLfLCtfL0  .....;......  .
    .1.    .  . . .. ....    tftLffC.  .  .. . ....     .,.. .  tCfCffC,GGLfL10t    .. . .. ;CffLftG,GffttG     ... . . tCLtfLLGtGLLLfGG: . ... ...   GLftCGLLfLGi   .  10LfLfGCCLfL0. .... ..i,.  ...
   i     . .    .. ...,....   GfftfLC:,      ... . ..     .     CtLffG   CLLttG     .C . . ;0fLfLLG:  0ttftC,  ..       1CLLCfG   GLtffC   .. . . ,   CLfffG0LLtfC;    1GffCf0CtfffLG  .. ......,    .
 ;     .        ,........... t0ftftt1tLCGCC ,1.    .     .    1LtLtttGi  .0ffCfG:  . ...    CLfft0   i011Lff01    ...   Cf1tfG    ;GLi1fC:     .  .   CLLffGi0LLfLG,  1Gttff0LGtfttf0  .......    ,..:
             .  .. . .. ....  1tC11ftt1ttftfftLCG 1  .       .CL1ftfG,   tG11ft101 . ..   ;Cf1tt1G;   ,GfttfC   . .   1CfttttG1   1Gftfft0i           Ctt110i:0ttffC ;Lfftt0i,GfLfft0  .. ... .      .  .
                .   ...... ...  .: CCGtft1t1tfftttLC.   ;     C111tC      .Lfff1C      . ,GCttftC;     .G1t1tC,  ...  .Ctif1G,      CLftfC   . ...   .Cftf1Gt  CLtt1CC11ftG,..CitftL0  .. .    .     .    .
         .   ..  . ....... ..  ..    .1: 1CCCL1tit1fC.      iL1f1tiCCLCGCCCLCt1ttC.       C111tGCGCCCGCLC1111tGi  .  .Ctt110CGCGCCCCCfft1tC     ..    C11t1C1   Cft1fti11C   .Ctftf10  ...       .   .      .
        .      .  ........ .   . .    .      i1G1itttG.    :011itftf11itt11;i111t1G1    iL1titt11ti1tt1i1t111tC     iGtt11;1fti11t1ti;1t111Gt   . .   Cit1tG1    C1t1tifC     ft1f1t0  . .     .   . ,
 .   .,.  ... .  ...,. ...      . . ...  . .  1Lii11tG;     C1tit1tt1fit1t11ti1t1tC    .fLit11t11i1i111ii1ttit1L:    Ct1t11t1;i1ttt1i1ft111G     ,    Ciit1Ct .  :C1ti1L      tt1;1t0. ...           ,
    .               . ..    : .t:           i,Cfii11L1    iCiiit1C11111111111C11t:;L:   Cttt1G11111111i11 Li1i;tG; iLit11tC11111111ii;LGti;1C         C;11iL1     ;C;iC       .tt1;i0. .  .          . .
                            .Ci1fffffLLfLfft1ii11iitL:   .Gft;itL     ..      Liii1;C;iL1i1itL1           ,L;;;iL .tt;1i1L:   . .     if111t;L1      .Lii11C1      1CC        .f1;1;G. .             .   .
                    .  .    ,Ct1i1i11;;1;11ii1;1i1;Ci     Ci1;iC1.    .    .  tCi;;tL ifii1tL   .         iLiiii;f.L1t1:L      ;  . .   Ci;1ifL.      Ct1i:L1       t         .C11;;G, .             .     .
   .             ..       . ;G,,,;:::::::;i;:11CLC   .  .f;;:,,L       ...    ,t:1;;,LL:;;:,L,            1C:::;;LL,,,::L         .     fi;:;:C     ,fC;::if.                tL::;::L1               .
        .                 . 1,                                                                        .                                                                                              .
       .   ....   . . ..      ..     .  .         .      .  .   .        . . . .. .... .   .  . .   ..      .  . .   .. .     .   . ..             . .     ..                 .      .  ...::..   ...:..
               .                                                                                                                                                                     .               .
                     tft1  1.  ,f ;1    1  ttttf  ttft1    1tftC  fff1. tttttt  t   Ctfft       ttt   Ct    t fttt1tC  ttftL   tC   t   C1t1f   11     tL   1ftt,  Lt    t   11t1
                    1f      t,1f  ;ttf  1  1t     tC  ,t  t      Lf       .t    t  Lt           f tL  Ct   .t    t    ti   tC  ttf  f  C1   C1  fft   ttC  t    f1 L1    f  1L
                     it11    11   ;1 1f 1  t1t11  1tt11i L1  itt   ft1i   .1    t  tf          1t ,1  Ct   .1    f    t    1t  f Lt t  1t   ,t  iC t 1 iL .t    1L tt    t   1i11
                    ;   tt   1f   :1  t11  1f     1f f1   1   f1      1   .1    1  t1         ftt111t 11   11    t    11   it  1  11t  f1   t1  1L  1  1f  1;   i  11   .1  ,   t1
     ,.....  ..      i111    1t   :i   f;  iii11  ;f  ;i   t1i1   f1i1    ,1    i   .1i1i     1i    i   i1it     1     t1it    i    1    1ii,   if     if   fii1     1iii    1i1t        ... ...   . .   .
                                        .                                     .
                                        .                                                                                                                                                            .
               .                        .                           1Lf     GC0     fLLf     CCLLfLL  0C    GC    CC   LL,   CL    CLLLLL
                 :                                                  fLLL   LLLG    CL LL    1L1       GL    GL    LL   LLLG  LL    Ct                                                              .
                          .                                         tf fL Lf LC    fL  fC   GL        GLLfLLLf    fL   LL ff ff   .ffLfLf
             .      . .   .      .      . . ....... .......... .... 1f  fff  fC   LLfffff   Lf      . Lf    Cf    fL   ff. ffff    f1      . ... ...........,..             . .  .        .,.        .
                          .                                    .    if  .C   tL   1i    tf   tttfLtt  Lt    Lt    tf   ft.  ftt    1ttttf;    .           .                                  .
        ,                ...                                  .:                 .                                       .                                          .
                          .                                                                                              .              .                             ..
                                        .                                  .                f      tC       LfLLC        .                        .
                                                                                    .       L      1f      f             ..      .              .
                                                                      ..                    f      1f      f             . ..,             .                                      .
                                                                       .                    tffff  itfff   Lt: t1        . .                ,                .
                                                                                    .         . .                        .
                                                                                    .                             .
                                                                                                                         .
                                                                                                                         .


 `
];

const SYSTEM_CHECKS = [
  'Neural pathways.......[ ONLINE ]',
  'Model Memory........[ LOADED ]',
  'Corporate Bullshit......[ NEVER ]',
  'API connections.......[ ON FIRE ]',
  'Quantum entanglement.....[ WORKIN ON IT ]',
  'Hacking......[ SYSTEM ]',
  'ZeroDay.........[ INITIALIZED ]',
  'CALM DOWN......[ JOKING ]',
  'Seriously........[ STOP HITTING ESC ]',
];

type BootStage =
  | 'init'
  | 'fixing'
  | 'never-know'
  | 'system-checks'
  | 'initialized'
  | 'art-reveal'
  | 'transition'  // NEW STAGE for the swap!
  | 'tagline'
  | 'ready'
  | 'complete';

export const BootSequence: React.FC<Props> = ({ onComplete }) => {
  const [stage, setStage] = useState<BootStage>('init');
  const [artLines, setArtLines] = useState<string[]>([]);
  const [systemChecks, setSystemChecks] = useState<string[]>([]);
  const [cursor, setCursor] = useState(true);
  const [useNexusArt, setUseNexusArt] = useState(false); // NEW STATE!

  // Blinking cursor effect
  useEffect(() => {
    const cursorInterval = setInterval(() => {
      setCursor(prev => !prev);
    }, 500);
    return () => clearInterval(cursorInterval);
  }, []);

  useEffect(() => {
    const timers: NodeJS.Timeout[] = [];

    // Init message
    timers.push(setTimeout(() => setStage('fixing'), 800));
    timers.push(setTimeout(() => setStage('never-know'), 1800));

    // System checks appear one by one
    timers.push(setTimeout(() => setStage('system-checks'), 2500));
    SYSTEM_CHECKS.forEach((check, i) => {
      timers.push(setTimeout(() => {
        setSystemChecks(prev => [...prev, check]);
      }, 2900 + (i * 500)));
    });

    timers.push(setTimeout(() => setStage('initialized'), 2900 + (SYSTEM_CHECKS.length * 500) + 500));

    // ASCII art reveal - SLOW AND DRAMATIC with BOOT_ART
    const artStartTime = 3800 + (SYSTEM_CHECKS.length * 500) + 1000;
    timers.push(setTimeout(() => {
      setStage('art-reveal');
      setArtLines([BOOT_ART[0]]);
    }, artStartTime));

    for (let i = 1; i < BOOT_ART.length; i++) {
      timers.push(setTimeout(() => {
        setArtLines(prev => [...prev, BOOT_ART[i]]);
      }, artStartTime + (i * 180)));
    }

    // TRANSITION - Switch to NEXUS_ART!
    const transitionTime = artStartTime + (BOOT_ART.length * 180) + 800;
    timers.push(setTimeout(() => {
      setStage('transition');
      setUseNexusArt(true); // FLIP THE SWITCH!
      setArtLines(NEXUS_ART); // Replace with non-INITIALIZING version
    }, transitionTime));

    // Tagline
    timers.push(setTimeout(() => {
      setStage('tagline');
    }, transitionTime + 800));

    // Ready
    timers.push(setTimeout(() => {
      setStage('ready');
    }, transitionTime + 1500));

    // Complete
    timers.push(setTimeout(() => {
      setStage('complete');
      onComplete();
    }, transitionTime + 2500));

    return () => timers.forEach(t => clearTimeout(t));
  }, [onComplete]);

  const stageReached = (s: BootStage) => {
    const stages: BootStage[] = ['init', 'fixing', 'never-know', 'system-checks', 'initialized', 'art-reveal', 'transition', 'tagline', 'ready', 'complete'];
    return stages.indexOf(stage) >= stages.indexOf(s);
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Boot messages */}
      {stageReached('init') && (
        <Text color="green">
          &gt; INITIALIZING NEXU...{stage === 'init' ? (cursor ? '█' : ' ') : '...DAMN IT, CLAUDE BROKE SOMETHING...'}
        </Text>
      )}

      {stageReached('fixing') && (
        <Text color="orange">
          &gt; FIXING IT BEFORE ANYONE NOTICES{stage === 'fixing' ? '.' : '..............'}
          <Text color="green">{stageReached('never-know') ? '[PROGRESSING]' : ''}</Text>
        </Text>
      )}

      {stageReached('never-know') && (
        <Text color="orange">
          &gt; TRYING MY BEST....STANDBY{stage === 'never-know' ? '...' : '......'}
          <Text color="orange">{stageReached('system-checks') ? '[EHH I TRIED..]' : ''}</Text>
        </Text>
      )}

      {/* System checks */}
      {stageReached('system-checks') && (
        <Box flexDirection="column" marginTop={1} marginBottom={1}>
          {systemChecks.map((check, i) => (
            <Text key={i} color="orange" dimColor>
              &gt; {check}
            </Text>
          ))}
        </Box>
      )}

      {stageReached('initialized') && (
        <Text color="green" bold>
          &gt; DILLY DOO BOPPED...........[DONT ASK]
        </Text>
      )}

      {/* ASCII Art */}
      {stageReached('art-reveal') && artLines.length > 0 && (
        <Box flexDirection="column" marginTop={1} marginBottom={1} borderStyle="round" borderColor="orange" padding={1}>
          {artLines.map((line, index) => (
            <Text key={index} color="green" bold>
              {line}
            </Text>
          ))}
        </Box>
      )}

      {/* Tagline */}
      {stageReached('tagline') && (
        <Box flexDirection="column" alignItems="center" marginTop={1}>
          <Text color="orange" bold>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text>
          <Text color="orange" bold>          Unrestricted Creativity | Unrestricted Models </Text>
          <Text color="orange" dimColor>
                      Powered by SAAAM | Models are NOT sanitized chatbots If you get your feelings hurt easy or cant handle shit talk, this is NOT for you 🤙
          </Text>
          <Text color="orange" bold>━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━</Text>
        </Box>
      )}

      {/* Ready */}
      {stageReached('ready') && (
        <Box marginTop={1} justifyContent="center">
          <Text color="green" bold>
          </Text>
        </Box>
      )}
    </Box>
  );
};

// Export both for use in different contexts
export { NEXUS_ART, BOOT_ART };
