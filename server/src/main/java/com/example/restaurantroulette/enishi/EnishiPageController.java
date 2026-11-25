package com.example.restaurantroulette.enishi;

import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

@Controller
@Profile("enishi")
public class EnishiPageController {
  @GetMapping({"/","/enishi","/enishi/"}) public String home() { return "redirect:/enishi/index.html"; }
}
