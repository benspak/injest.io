import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {useRoute} from '@react-navigation/native';
import type {RouteProp} from '@react-navigation/native';
import {apiClient} from '../api/client';
import type {Item, Collection} from '../api/types';
import type {RootStackParamList} from '../navigation/AppNavigator';
import {ItemCard} from '../components/ItemCard';

type CollectionDetailRouteProp = RouteProp<
  RootStackParamList,
  'CollectionDetail'
>;

export const CollectionDetailScreen: React.FC = () => {
  const route = useRoute<CollectionDetailRouteProp>();
  const {collectionId} = route.params;
  const [collection, setCollection] = useState<Collection | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadCollection();
    loadItems();
  }, [collectionId]);

  const loadCollection = async () => {
    try {
      const data = await apiClient.getCollection(collectionId);
      setCollection(data);
    } catch (error) {
      console.error('Failed to load collection:', error);
    }
  };

  const loadItems = async () => {
    try {
      const data = await apiClient.getCollectionItems(collectionId);
      setItems(data);
    } catch (error) {
      console.error('Failed to load items:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadCollection(), loadItems()]);
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!collection) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Collection not found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{collection.title}</Text>
        {collection.description && (
          <Text style={styles.description}>{collection.description}</Text>
        )}
        <Text style={styles.itemCount}>
          {items.length} {items.length === 1 ? 'item' : 'items'}
        </Text>
      </View>
      <FlatList
        data={items}
        keyExtractor={item => item.id}
        renderItem={({item}) => <ItemCard item={item} onPress={() => {}} />}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#007AFF"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No items in this collection</Text>
          </View>
        }
      />
    </View>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#8E8E93',
    marginBottom: 8,
  },
  itemCount: {
    fontSize: 14,
    color: '#8E8E93',
  },
  listContent: {
    padding: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#8E8E93',
  },
  errorText: {
    fontSize: 16,
    color: '#8E8E93',
  },
});
