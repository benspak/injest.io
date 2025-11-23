import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
  Image,
} from 'react-native';
import {launchImageLibrary, launchCamera, ImagePickerResponse} from 'react-native-image-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {apiClient} from '../api/client';

export const CaptureScreen: React.FC = () => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleImagePicker = (response: ImagePickerResponse) => {
    if (response.didCancel || response.errorCode) {
      return;
    }

    if (response.assets && response.assets[0]) {
      const asset = response.assets[0];
      if (asset.uri) {
        setSelectedImage(asset.uri);
      }
    }
  };

  const openCamera = () => {
    launchCamera({mediaType: 'photo', quality: 0.8}, handleImagePicker);
  };

  const openImageLibrary = () => {
    launchImageLibrary({mediaType: 'photo', quality: 0.8}, handleImagePicker);
  };

  const handleSubmit = async () => {
    if (!title.trim() && !description.trim() && !selectedImage) {
      Alert.alert('Error', 'Please add a title, description, or image');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();

      if (title.trim()) {
        formData.append('title', title.trim());
      }

      if (description.trim()) {
        formData.append('description', description.trim());
      }

      if (tags.trim()) {
        const tagArray = tags.split(',').map(t => t.trim()).filter(Boolean);
        formData.append('tags', JSON.stringify(tagArray));
      }

      if (selectedImage) {
        formData.append('type', 'file');
        formData.append('attachments', {
          uri: selectedImage,
          type: 'image/jpeg',
          name: 'photo.jpg',
        } as any);
      } else {
        formData.append('type', 'note');
        if (description.trim()) {
          formData.append('raw', description.trim());
        }
      }

      await apiClient.createItem(formData);
      Alert.alert('Success', 'Item created successfully', [
        {
          text: 'OK',
          onPress: () => {
            setTitle('');
            setDescription('');
            setTags('');
            setSelectedImage(null);
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Capture</Text>
        <Text style={styles.subtitle}>Add a note, photo, or link</Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Title (optional)"
          placeholderTextColor="#8E8E93"
          value={title}
          onChangeText={setTitle}
        />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Description or note..."
          placeholderTextColor="#8E8E93"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={6}
        />

        <TextInput
          style={styles.input}
          placeholder="Tags (comma-separated)"
          placeholderTextColor="#8E8E93"
          value={tags}
          onChangeText={setTags}
        />

        {selectedImage && (
          <View style={styles.imageContainer}>
            <Image source={{uri: selectedImage}} style={styles.image} />
            <TouchableOpacity
              style={styles.removeImageButton}
              onPress={() => setSelectedImage(null)}>
              <Icon name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.cameraButton]}
            onPress={openCamera}>
            <Icon name="camera-alt" size={24} color="#fff" />
            <Text style={styles.buttonText}>Camera</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.galleryButton]}
            onPress={openImageLibrary}>
            <Icon name="photo-library" size={24} color="#fff" />
            <Text style={styles.buttonText}>Gallery</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={isSubmitting}>
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Save</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  content: {
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#8E8E93',
  },
  form: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
  },
  input: {
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 16,
    color: '#000',
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  imageContainer: {
    position: 'relative',
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: 200,
    resizeMode: 'cover',
  },
  removeImageButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  cameraButton: {
    backgroundColor: '#007AFF',
  },
  galleryButton: {
    backgroundColor: '#34C759',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
