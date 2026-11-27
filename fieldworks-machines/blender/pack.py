# Pack every models/*.glb as models/<name>.glb.js (a base64 module) so the web demo can load it.
import base64, glob, os
d = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'models')
for f in glob.glob(os.path.join(d, '*.glb')):
    open(f + '.js', 'w').write('export default "' + base64.b64encode(open(f, 'rb').read()).decode() + '";\n')
    print('packed', os.path.basename(f))
