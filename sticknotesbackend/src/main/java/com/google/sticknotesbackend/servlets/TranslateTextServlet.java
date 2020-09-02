package com.google.sticknotesbackend.servlets;

import com.google.appengine.api.users.UserService;
import com.google.appengine.api.users.UserServiceFactory;
import com.google.cloud.translate.Translate;
import com.google.cloud.translate.TranslateOptions;
import com.google.cloud.translate.Translation;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.sticknotesbackend.exceptions.PayloadValidationException;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

/**
 * Translates a text using Translate API
 */
@WebServlet("api/translate/")
public class TranslateTextServlet extends AppAbstractServlet {
  @Override
  protected void doPost(HttpServletRequest request, HttpServletResponse response) throws ServletException, IOException {
    UserService userService = UserServiceFactory.getUserService();
    // if user is not authenticated, deny access to the resource
    if (!userService.isUserLoggedIn()) {
      unauthorized(response);
      return;
    }
    JsonObject body = JsonParser.parseReader(request.getReader()).getAsJsonObject();
    try {
      String[] requiredFields = {"text", "targetLanguage"};
      validateRequestData(body, response, requiredFields);
    } catch (PayloadValidationException ex) {
      badRequest(ex.getMessage(), response);
    }
    // get list of texts that has to be translated
    JsonArray textsJsonArray = body.get("text").getAsJsonArray();
    ArrayList<String> texts = new ArrayList<>();
    for (JsonElement element: textsJsonArray) {
      texts.add(element.getAsString());
    }
    String targetLanguage = body.get("targetLanguage").getAsString();
    // translate text
    Translate translate = TranslateOptions.getDefaultInstance().getService();
    List<Translation> translation = translate.translate(texts, Translate.TranslateOption.targetLanguage(targetLanguage));
    // construct a JSON response
    JsonObject responseJson = new JsonObject();
    responseJson.addProperty("result", translation.getTranslatedText());
    // set character encoding to UTF-8 to allow non latin characters
    response.setCharacterEncoding("UTF-8");
    response.getWriter().print(responseJson.toString());
  }
}
