/**
 * Copyright 2020 Google LLC
 * 
 * This class manages UserBoardRole, Notes and Board objects in memcache.
 */
package com.google.sticknotesbackend;

import static com.googlecode.objectify.ObjectifyService.ofy;

import com.google.sticknotesbackend.models.User;
import com.google.sticknotesbackend.models.UserBoardRole;
import com.google.sticknotesbackend.models.Whiteboard;
import com.google.sticknotesbackend.models.Note;
import com.googlecode.objectify.Key;

import javax.cache.Cache;


/**
 * This class provides a few methods that speed up datastore read operations by using Memcache.
 * Basically this is an additional layer between code and datastore that uses cache.
 */
public class FastStorage extends LocalCacheManager{
  /**
   * Updates the board in datastore.
   * Updates the "lastUpdated" field.
   * Stores the board in cache
   * !!!!! ALWAYS PUT FULL BOARD HERE !!!! 
   * !!!!! NEVER PASS BOARD LOADED WITH LOAD GROUP WITHOUT NOTES OR BOARD LINES HERE !!!!!
   */
  public static void updateBoard(Whiteboard board) {
    board.lastUpdated = System.currentTimeMillis();
    ofy().save().entity(board).now();
    // insert board in cache
    Cache cache = getCacheInstance();
    // store board in cache as well, use board id as cache key
    cache.put(Long.toString(board.id), board);
  }

  /**
   * Returns the board with given id if it exists or null otherwise
   * Tries to get board from cache, if cache is empty, loads board from datastore
   * Loads all fields except notes and creator
   */
  public static Whiteboard getWhiteboardLite(Long boardId) {
    // try to load board from cache
    Cache cache = getCacheInstance();
    String cacheKey = Long.toString(boardId);
    Whiteboard board = (Whiteboard)cache.get(cacheKey);
    if (board == null) {
      // if cache is empty, load from datastore
      Key<Whiteboard> boardKey = Key.create(Whiteboard.class, boardId);
      board = ofy().load().group(Whiteboard.WithoutNotesAndCreator.class).key(boardKey).now();
      // save board in cache for future use
      cache.put(cacheKey, board);
    }
    return board;
  }

  /**
   * Returns a UserBoardRole object for given board and user with given google acc id.
   * Tries to get value from cache, if it is empty gets value from datastore and updates cache
   */
  public static UserBoardRole getUserBoardRole(Long boardId, String googleAccId) {
    Cache cache = getCacheInstance();
    String cacheKey = Long.toString(boardId) + "-" + googleAccId;
    UserBoardRole role = (UserBoardRole)cache.get(cacheKey);
    if (role == null) {
      // role is not in cache yet, so load it and put into cache
      // get current user
      User user = ofy().load().type(User.class).filter("googleAccId", googleAccId).first().now();
      // find the first role with the user and board
      role = ofy().load().type(UserBoardRole.class).ancestor(Key.create(Whiteboard.class, boardId)).filter("user", user).first().now();
      // store role in cache
      // of course if role doesn't exist it will store null in cache, and later calls will not utilize cache
      // for now to keep things simpler let's not think about it
      cache.put(cacheKey, role);
    }
    return role;
  }

  /**
   * Removes role from cache and from datastore
   * @param role
   */
  public static void removeUserBoardRole(UserBoardRole role) {
    Cache cache = getCacheInstance();
    String cacheKey = Long.toString(role.boardId) + "-" + role.getUser().googleAccId;
    cache.remove(cacheKey);
    ofy().delete().entity(role).now();
  }

  /**
   * Removes board with given id from cache and from datastore
   * @param board
   */
  public static void removeBoard(Whiteboard board) {
    Cache cache = getCacheInstance();
    String cacheKey = Long.toString(board.id);
    cache.remove(cacheKey);
    ofy().delete().entity(board).now();
  }

  /**
   * @param noteId - note to retrieve
   * Returns a Note object for given note id.
   * Tries to get value from cache, if it is empty gets value from datastore and updates cache
   */
  public static Note getNote(Long noteId){
    Cache cache = getCacheInstance();
    Note note = (Note)cache.get(Long.toString(noteId));
    if(note == null){
      note = ofy().load().type(Note.class).id(noteId).now();
      cache.put(Long.toString(noteId), note);
    }
    return note;
  }

  /**
   * @param note - note to update
   * Updates the "lastUpdated" field.
   * Updates the note in datastore.
   * Stores the note in cache
   */
  public static void updateNote(Note note){
    note.lastUpdated = System.currentTimeMillis();
    ofy().save().entity(note).now();

    Cache cache = getCacheInstance();
    cache.put(Long.toString(note.id), note);
  }

  /**
   * Removes note from cache and from datastore
   * @param note - note to remove
   */
  public static void removeNote(Note note){
    Cache cache = getCacheInstance();
    String cacheKey = Long.toString(note.id);
    cache.remove(cacheKey);
    ofy().delete().entity(note).now();
  }
}
