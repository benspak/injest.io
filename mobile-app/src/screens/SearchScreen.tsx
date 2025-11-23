import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import {apiClient} from '../api/client';
import type {SearchResult} from '../api/types';
import type {RootStackParamList} from '../navigation/AppNavigator';
import {ItemCard} from '../components/ItemCard';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export const SearchScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await apiClient.search(searchQuery.trim());
      setResults(response.results);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleItemPress = (itemId: string) => {
    navigation.navigate('ItemDetail', {itemId});
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Icon name="search" size={20} color="#8E8E93" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search your items..."
          placeholderTextColor="#8E8E93"
          value={query}
          onChangeText={text => {
            setQuery(text);
            handleSearch(text);
          }}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {isSearching && (
          <ActivityIndicator size="small" color="#007AFF" style={styles.loader} />
        )}
      </View>

      {results.length > 0 ? (
        <FlatList
          data={results}
          keyExtractor={item => item.entityId}
          renderItem={({item}) => {
            if (item.entityType === 'item' && item.item) {
              return (
                <ItemCard
                  item={item.item}
                  onPress={() => handleItemPress(item.item!.id)}
                />
              );
            }
            return null;
          }}
          contentContainerStyle={styles.listContent}
        />
      ) : query.trim() ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No results found</Text>
        </View>
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="search" size={64} color="#C7C7CC" />
          <Text style={styles.emptyText}>Start typing to search</Text>
          <Text style={styles.emptySubtext}>
            Search across all your items, notes, and files
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  searchContainer: {
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#000',
  },
  loader: {
    marginLeft: 8,
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
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8E8E93',
    marginTop: 8,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
