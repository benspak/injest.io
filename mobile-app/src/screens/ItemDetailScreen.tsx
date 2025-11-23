import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Image,
} from 'react-native';
import {useRoute, useNavigation} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {apiClient} from '../api/client';
import type {Item} from '../api/types';
import type {RootStackParamList} from '../navigation/AppNavigator';

type ItemDetailRouteProp = RouteProp<RootStackParamList, 'ItemDetail'>;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const ItemDetailScreen: React.FC = () => {
  const route = useRoute<ItemDetailRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const {itemId} = route.params;
  const [item, setItem] = useState<Item | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadItem();
  }, [itemId]);

  const loadItem = async () => {
    try {
      const data = await apiClient.getItem(itemId);
      setItem(data);
    } catch (error) {
      console.error('Failed to load item:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!item) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Item not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.typeBadge}>
          <Icon
            name={
              item.type === 'link'
                ? 'link'
                : item.type === 'file'
                ? 'insert-drive-file'
                : item.type === 'email'
                ? 'email'
                : 'note'
            }
            size={16}
            color="#007AFF"
          />
          <Text style={styles.typeText}>{item.type || 'note'}</Text>
        </View>
        <Text style={styles.title}>{item.title || 'Untitled'}</Text>
        <Text style={styles.date}>{formatDate(item.created_at)}</Text>
      </View>

      {item.description && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{item.description}</Text>
        </View>
      )}

      {item.url && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>URL</Text>
          <TouchableOpacity>
            <Text style={styles.url}>{item.url}</Text>
          </TouchableOpacity>
        </View>
      )}

      {item.clean && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Content</Text>
          <Text style={styles.content}>{item.clean}</Text>
        </View>
      )}

      {item.notes && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <Text style={styles.notes}>{item.notes}</Text>
        </View>
      )}

      {item.tags && item.tags.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tags</Text>
          <View style={styles.tagsContainer}>
            {item.tags.map((tag, index) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {item.attachments && item.attachments.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attachments</Text>
          {item.attachments.map((attachment, index) => (
            <View key={index} style={styles.attachment}>
              <Icon name="attach-file" size={20} color="#007AFF" />
              <Text style={styles.attachmentText}>{attachment.filename}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#fff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E5F4FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  date: {
    fontSize: 14,
    color: '#8E8E93',
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#000',
    lineHeight: 24,
  },
  url: {
    fontSize: 16,
    color: '#007AFF',
    textDecorationLine: 'underline',
  },
  content: {
    fontSize: 16,
    color: '#000',
    lineHeight: 24,
  },
  notes: {
    fontSize: 16,
    color: '#000',
    lineHeight: 24,
    fontStyle: 'italic',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: '#E5E5EA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  tagText: {
    fontSize: 14,
    color: '#007AFF',
  },
  attachment: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#F2F2F7',
    borderRadius: 8,
    marginBottom: 8,
  },
  attachmentText: {
    fontSize: 14,
    color: '#000',
    marginLeft: 8,
  },
  errorText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});
