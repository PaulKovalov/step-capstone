/*
* Copyright 2020 Google LLC
*/
package com.google.sticknotesbackend.models;

import com.googlecode.objectify.Ref;
import com.googlecode.objectify.annotation.Entity;
import com.googlecode.objectify.annotation.Id;
import com.googlecode.objectify.annotation.Load;

import java.io.Serializable;
import java.util.ArrayList;

@Entity
public class Whiteboard implements Serializable {
  // used by load group in order to not load notes
  public static class WithoutNotesAndCreator {}
  public static class WithoutGridLines {}

  public @Id Long id;
  public Long creationDate; // it's a timestamp
  public Long lastUpdated; // time when board was last updated
  private @Load(unless=WithoutNotesAndCreator.class) Ref<User> creator;
  public String title;
  public int rows;
  public int cols;
  public String backgroundImg;
  public @Load(unless=WithoutNotesAndCreator.class) ArrayList<Ref<Note>> notes = new ArrayList<>();
  public @Load(unless=WithoutGridLines.class) ArrayList<Ref<BoardGridLine>> gridLines = new ArrayList<>();

  public Whiteboard() {
    this.rows = -1;
    this.cols = -1;
    this.lastUpdated = 0L;
  }

  public Whiteboard(String title) {
    this(); // call default constructor to initialize necessary fields
    this.title = title;
  }

  public User getCreator() {
    return creator.get();
  }

  public void setCreator(User user) {
    this.creator = Ref.create(user);
  }
}
