/**
 * Copyright 2020 Google LLC
 */
package com.google.sticknotesbackend;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.sticknotesbackend.models.Note;
import com.google.sticknotesbackend.models.UserBoardRole;
import com.google.sticknotesbackend.models.Whiteboard;
import com.google.sticknotesbackend.serializers.NoteSerializer;
import com.google.sticknotesbackend.serializers.UserBoardRoleSerializer;
import com.google.sticknotesbackend.serializers.WhiteboardPreviewSerializer;
import com.google.sticknotesbackend.serializers.WhiteboardSerializer;
import com.google.sticknotesbackend.serializers.WhiteboardWithoutNotesSerializer;

public class JsonParsers {
  /**
   * Generates a Gson object that uses custom WhiteboardSerializer when
   * serializing Whiteboard objects.
   */
  public static Gson getBoardGsonParser() {
    GsonBuilder gson = new GsonBuilder();
    gson.registerTypeAdapter(Whiteboard.class, new WhiteboardSerializer());
    return gson.create();
  }

  /**
   * Generates a Gson object that uses custom NoteSerializer when serializing Note
   * objects
   */
  public static Gson getNoteGsonParser() {
    GsonBuilder gson = new GsonBuilder();
    gson.registerTypeAdapter(Note.class, new NoteSerializer());
    return gson.create();
  }
  /**
   * Generates a Gson object that uses custom WhiteboardPreviewSerializer
   */
  public static Gson getBoardPreviewGsonParser() {
    GsonBuilder gson = new GsonBuilder();
    gson.registerTypeAdapter(Whiteboard.class, new WhiteboardPreviewSerializer());
    return gson.create();
  }

  /**
   * Generates a Gson object that uses custom WhiteboardWithoutNotesSerializer when
   * serializing Whiteboard objects.
   */
  public static Gson getBoardUpdateGsonParser() {
    GsonBuilder gson = new GsonBuilder();
    gson.registerTypeAdapter(Whiteboard.class, new WhiteboardWithoutNotesSerializer());
    return gson.create();
  }

  /**
   * Generates a Gson object that uses custom UserBoardRoleSerializer when
   * serializing UserBoardRole objects.
   */
  public static Gson getBoardRoleGsonParser() {
    GsonBuilder gson = new GsonBuilder();
    gson.registerTypeAdapter(UserBoardRole.class, new UserBoardRoleSerializer());
    return gson.create();
  }
}
