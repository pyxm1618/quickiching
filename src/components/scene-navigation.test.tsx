import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it,vi} from "vitest";
const navigationState=vi.hoisted(()=>({pathname:"/"}));
vi.mock("next/navigation",()=>({usePathname:()=>navigationState.pathname}));
vi.mock("next/link",()=>({default:({href,children,prefetch:_prefetch,...props}:any)=><a href={href} {...props}>{children}</a>}));
vi.mock("next/image",()=>({default:({priority:_priority,unoptimized:_unoptimized,...props}:any)=>React.createElement("img",props)}));
import {SceneNavigation} from "./scene-navigation";
import { surfaceContract } from "@/navigation/surface-contract";
import {SceneNavigationPanels} from "./scene-navigation-panels";
import {UserNavControl} from "./auth/user-nav-control";
const paths=["/hexagrams","/methods/yarrow-stalks","/methods/mei-hua-yi-shu","/methods/manual-cast","/guides/how-to-ask-the-i-ching","/guides/changing-lines","/guides/primary-relating-hexagrams","/help","/privacy","/terms","/acceptable-use"];
describe("approved scene navigation integration",()=>{
 it.each(["en","zh-Hans"] as const)("preserves all existing destinations for %s",locale=>{
  const core=renderToStaticMarkup(<SceneNavigation locale={locale}/>);
  const methods=renderToStaticMarkup(<SceneNavigationPanels locale={locale} panel="methods" id="fixture" onClose={()=>{}}/>);
  const info=renderToStaticMarkup(<SceneNavigationPanels locale={locale} panel="info" id="fixture" onClose={()=>{}}/>);
  const html=core+methods+info;
  for(const path of paths)expect(html).toContain(`href="${locale==="en"?"":"/zh"}${path}"`);
  expect(html).toContain('href="mailto:support@quickiching.com"');
  expect(html).not.toMatch(/href="(?:\/zh)?\/methods"/);
  expect(core).toContain('aria-expanded="false"');
  expect(core).toContain("data-scene-route-graph");
  for(const path of paths.filter(path=>path!=="/hexagrams"))expect(core).toContain(`href="${locale==="en"?"":"/zh"}${path}"`);
  expect(core).toContain('href="mailto:support@quickiching.com"');
  expect(core).not.toContain("scene-methods-panel");
  expect(core).not.toContain("scene-info-panel");
  expect(core).not.toContain("/navigation/method-yarrow.webp");
 });
 it("switches to the locale-equivalent route outside the homepage",()=>{
  navigationState.pathname="/hexagrams";
  const english=renderToStaticMarkup(<SceneNavigation locale="en"/>);
  expect(english).toContain('href="/zh/hexagrams"');
  navigationState.pathname="/zh/hexagrams";
  const chinese=renderToStaticMarkup(<SceneNavigation locale="zh-Hans"/>);
  expect(chinese).toContain('href="/hexagrams"');
  navigationState.pathname="/";
 });
 it("keeps the approved live HTML labels and privacy entry",()=>{
  const core=renderToStaticMarkup(<SceneNavigation/>);
  const methods=renderToStaticMarkup(<SceneNavigationPanels locale="en" panel="methods" id="fixture" onClose={()=>{}}/>);
  const info=renderToStaticMarkup(<SceneNavigationPanels locale="en" panel="info" id="fixture" onClose={()=>{}}/>);
  const html=core+methods+info;
  for(const label of ["Hexagrams","Other Methods","Info","Yarrow Stalks","Mei Hua Yi Shu","Manual Cast","Privacy Settings","EN","中文"])expect(html).toContain(label);
 });
 it("renders a non-clickable partnership label with three scrollable partner links only on S01",()=>{
  const home=renderToStaticMarkup(<SceneNavigation locale="en" contract={surfaceContract("S01")}/>);
  expect(home).toContain('<div class="scene-partnership"><span class="scene-partnership-label">In partnership with</span><div class="scene-partner-list" aria-label="Partner links">');
  expect(home).not.toContain('<a class="scene-partnership"');
  expect(home.match(/class="scene-partner-link"/g)).toHaveLength(3);
  expect(home).toContain('href="https://startupfa.me/s/quick-i-ching?utm_source=www.quickiching.com"');
  expect(home).toContain('src="https://startupfa.me/badge?t=small&amp;theme=dark"');
  expect(home).toContain('href="https://www.betterlaunch.co/product/quick-i-ching"');
  expect(home).toContain('src="https://www.betterlaunch.co/badge-launching-gradient.svg"');
  expect(home).toContain('href="https://shipstry.com/"');
  expect(home).toContain('src="https://shipstry.com/badges/featured.svg"');
  expect(home.match(/target="_blank"/g)).toHaveLength(3);
  expect(home.match(/rel="noopener noreferrer"/g)).toHaveLength(3);

  const chineseHome=renderToStaticMarkup(<SceneNavigation locale="zh-Hans" contract={surfaceContract("S01")}/>);
  expect(chineseHome).toContain('<span class="scene-partnership-label">合作伙伴</span>');
  expect(chineseHome).toContain('aria-label="合作伙伴链接"');
  expect(chineseHome).not.toContain("In partnership with");

  const refining=renderToStaticMarkup(<SceneNavigation locale="en" contract={surfaceContract("S02")}/>);
  expect(refining).not.toContain("scene-partnership");
  expect(refining).not.toContain("startupfa.me");
  expect(refining).not.toContain("betterlaunch.co");
  expect(refining).not.toContain("shipstry.com");
 });

 it("reuses the sign-in callback without introducing a second signup flow",()=>{
  const html=renderToStaticMarkup(<UserNavControl appearance="scene" initialUser={null}/>);
  expect(html).toContain('href="/signin?callbackURL=%2F"');expect(html).toContain("Sign In");expect(html).not.toContain('/signup');
 });
 it("retains the existing authenticated readings, account and settings menu",()=>{
  const html=renderToStaticMarkup(<UserNavControl appearance="scene" initialUser={{id:"fixture",email:"reader@example.com"}} initialOpen/>);
  expect(html).toContain('>Account<');expect(html).toContain('href="/my-readings"');expect(html).toContain("My Account");expect(html).toContain("Settings");
 });
 it("obeys accountControl even when auth capability is enabled",()=>{
  for (const surfaceId of ["S17","S18"] as const) {
   const html=renderToStaticMarkup(<SceneNavigation locale="en" authEnabled contract={surfaceContract(surfaceId)}/>);
   expect(html).not.toContain("data-shell-account");
  }
  const allowed=renderToStaticMarkup(<SceneNavigation locale="en" authEnabled contract={surfaceContract("S06")}/>);
  expect(allowed).toContain("data-shell-account");
 });
});
