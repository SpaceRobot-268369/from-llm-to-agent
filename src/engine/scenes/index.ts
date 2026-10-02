import type { Scene, SceneId } from './types';
import hero from './hero';
import tokens from './tokens';
import scaling from './scaling';
import thinking from './thinking';
import chat from './chat';
import system from './system';
import window from './window';
import memory from './memory';
import rag from './rag';
import tools from './tools';
import agent from './agent';
import mcp from './mcp';
import skill from './skill';
import agentfiles from './agentfiles';
import subagents from './subagents';
import agents from './agents';
import part from './part';
import unwrap from './unwrap';

export const SCENES: Record<SceneId, Scene> = {
  hero,
  tokens,
  scaling,
  thinking,
  chat,
  system,
  window,
  memory,
  rag,
  tools,
  agent,
  mcp,
  skill,
  agentfiles,
  subagents,
  agents,
  part,
  unwrap,
};
