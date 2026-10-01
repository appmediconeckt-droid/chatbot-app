// Real staff photo picker: camera or gallery, returned as a small JPEG data
// URI so it can travel inside the JSON body of POST/PATCH /api/staff (the
// staff API takes no multipart upload). Kept small (360px, q0.6 ≈ 20–40 KB)
// to stay well under the server's JSON body limit.
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';

const OPTIONS = {
  mediaType: 'photo',
  selectionLimit: 1,
  includeBase64: true,
  maxWidth: 360,
  maxHeight: 360,
  quality: 0.6,
};

const toDataUri = (result) => {
  if (result?.didCancel) return null;
  if (result?.errorCode) throw new Error(result.errorMessage || 'Could not open the photo picker');
  const asset = result?.assets?.[0];
  if (!asset?.base64) return null;
  return `data:${asset.type || 'image/jpeg'};base64,${asset.base64}`;
};

const ensureCameraPermission = async () => {
  if (Platform.OS !== 'android') return true;
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  return granted === PermissionsAndroid.RESULTS.GRANTED;
};

// Resolves to a data URI, or null if the user cancelled.
export const pickStaffPhoto = () => new Promise((resolve, reject) => {
  const fromCamera = async () => {
    try {
      if (!(await ensureCameraPermission())) {
        reject(new Error('Camera permission is needed to take a photo.'));
        return;
      }
      resolve(toDataUri(await launchCamera({ ...OPTIONS, cameraType: 'front', saveToPhotos: false })));
    } catch (err) {
      reject(err);
    }
  };
  const fromGallery = async () => {
    try {
      resolve(toDataUri(await launchImageLibrary(OPTIONS)));
    } catch (err) {
      reject(err);
    }
  };
  Alert.alert('Staff photo', 'Add a photo of the staff member', [
    { text: 'Take Photo', onPress: fromCamera },
    { text: 'Choose from Gallery', onPress: fromGallery },
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
  ], { cancelable: true, onDismiss: () => resolve(null) });
});
