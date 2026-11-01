import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {describe,expect,it,vi} from "vitest";
vi.mock("next/navigation",()=>({usePathname:()=>"/"}));
vi.mock("next/link",()=>({default:({href,children,prefetch:_prefetch,...props}:any)=><a href={href} {...props}>{children}</a>}));
vi.mock("next/image",()=>({default:({priority:_priority,unoptimized:_unoptimized,...props}:any)=>React.createElement("img",props)}));
import {SceneNavigation} from "./scene-navigation";
import {UserNavControl} from "./auth/user-nav-control";
const paths=["/hexagrams","/methods/yarrow-stalks","/methods/mei-hua-yi-shu","/methods/manual-cast","/guides/how-to-ask-the-i-ching","/guides/changing-lines","/guides/primary-relating-hexagrams","/help","/privacy","/terms","/acceptable-use"];
describe("approved scene navigation integration",()=>{
 it.each(["en","zh-Hans"] as const)("preserves all existing destinations for %s",locale=>{
  const html=renderToStaticMarkup(<SceneNavigation locale={locale}/>);
  for(const path of paths)expect(html).toContain(`href="${locale==="en"?"":"/zh"}${path}"`);
  expect(html).toContain('href="mailto:support@quickiching.com"');
  expect(html).not.toMatch(/href="(?:\/zh)?\/methods"/);
  expect(html.match(/hidden=""/g)).toHaveLength(2);
  expect(html).toContain('aria-expanded="false"');
 });
 it("keeps the approved live HTML labels and privacy entry",()=>{
  const html=renderToStaticMarkup(<SceneNavigation/>);
  for(const label of ["Hexagrams","Other Methods","Info","Yarrow Stalks","Mei Hua Yi Shu","Manual Cast","Privacy Settings","EN","中文"])expect(html).toContain(label);
 });
 it("reuses the sign-in callback without introducing a second signup flow",()=>{
  const html=renderToStaticMarkup(<UserNavControl appearance="scene" initialUser={null}/>);
  expect(html).toContain('href="/signin?callbackURL=%2F"');expect(html).toContain("Sign In");expect(html).not.toContain('/signup');
 });
 it("retains the existing authenticated readings, account and settings menu",()=>{
  const html=renderToStaticMarkup(<UserNavControl appearance="scene" initialUser={{id:"fixture",email:"reader@example.com"}} initialOpen/>);
  expect(html).toContain('>Account<');expect(html).toContain('href="/my-readings"');expect(html).toContain("My Account");expect(html).toContain("Settings");
 });
});
